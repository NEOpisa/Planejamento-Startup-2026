/**
 * As salas no Supabase — o registro para quem já tem um lá.
 *
 * Faz o mesmo que o `registro-redis.mjs`, com as duas peças que o Supabase
 * oferece prontas:
 *
 * - **uma tabela** com quem está em cada sala, lida e escrita pela API HTTP
 *   (nada de conexão TCP com o banco: numa função serverless isso significa
 *   não brigar com pooler, com limite de conexões nem com `LISTEN/NOTIFY`,
 *   que não atravessa o pooler em modo transação);
 * - **o Realtime** para o recado atravessar de uma instância para a outra,
 *   pelo canal `nvdisc:{sala}`.
 *
 * A escolha entre isto e o Redis é de quem hospeda, não do protocolo: os dois
 * expõem a mesma interface e são conferidos pelo mesmo teste
 * (`npm run test:instancias`).
 *
 * As credenciais vêm sempre do ambiente. A chave é a **secreta** (service
 * role), e ela nunca chega ao navegador: quem fala com o Supabase é a função,
 * não a página. É por isso que a tabela pode ficar fechada para o público.
 */

import { createClient } from "@supabase/supabase-js";

import { LIMITES } from "./protocolo.mjs";

/** A tabela; o SQL para criá-la está em `supabase/nvdisc.sql`. */
const TABELA = "nvdisc_participantes";

/** Quanto tempo sem batimento até alguém ser considerado morto. */
const VALIDADE = Number(process.env.NVDISC_VALIDADE_MS ?? 70_000);
/** De quanto em quanto tempo vale varrer os mortos de uma sala. */
const INTERVALO_MANUTENCAO = Number(process.env.NVDISC_MANUTENCAO_MS ?? 45_000);

const canal = (sala) => `nvdisc:${sala}`;

export function criarRegistroSupabase(url, chave) {
  const bd = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 40 } },
  });

  /** sala → canal do Realtime desta instância */
  const canais = new Map();
  /** sala → quando a varredura rodou por aqui pela última vez */
  const ultimaVarredura = new Map();

  const linhaParaParticipante = (l) => ({
    id: l.id,
    nome: l.nome,
    mudo: l.mudo,
    tela: l.tela,
    conexao: l.conexao,
  });

  async function listar(sala) {
    const { data, error } = await bd
      .from(TABELA)
      .select("id, nome, mudo, tela, conexao")
      .eq("sala", sala);
    if (error) throw new Error(`não consegui ler a sala: ${error.message}`);
    return (data ?? []).map(linhaParaParticipante);
  }

  /**
   * Tira da sala quem parou de dar sinal de vida, e diz quem tirou.
   *
   * É a rede de segurança para a instância que morre sem fechar as conexões:
   * ninguém executa o `close`, e sem isto aquelas pessoas ficariam na lista
   * para sempre, com os outros tentando falar com fantasmas.
   *
   * O `delete ... select()` devolve **as linhas que esta chamada apagou**. É
   * o que impede a mesma saída de ser anunciada uma vez por instância: todas
   * varrem, todas veem os mesmos mortos, e só quem apagou de fato conta.
   */
  async function varrer(sala, sempre = false) {
    const agora = Date.now();
    if (!sempre && agora - (ultimaVarredura.get(sala) ?? 0) < INTERVALO_MANUTENCAO) {
      return [];
    }
    ultimaVarredura.set(sala, agora);

    const corte = new Date(agora - VALIDADE).toISOString();
    const { data, error } = await bd
      .from(TABELA)
      .delete()
      .eq("sala", sala)
      .lt("visto_em", corte)
      .select("id");
    if (error) return [];
    return (data ?? []).map((l) => l.id);
  }

  return {
    nome: "supabase",

    async entrar(sala, p) {
      const atual = await listar(sala);
      const antigo = atual.find((o) => o.id === p.id);

      if (!antigo && atual.length >= LIMITES.POR_SALA) {
        return {
          erro:
            `esta sala já está com ${LIMITES.POR_SALA} pessoas, que é o limite. ` +
            `A conversa é direta entre os navegadores, e acima disso a conexão de ` +
            `quem tem internet mais fraca começa a sofrer.`,
        };
      }

      // Quem volta mantém o que já havia dito sobre si (microfone, tela): a
      // reconexão não é uma pessoa nova, é a mesma continuando.
      const registrado = {
        ...p,
        mudo: antigo?.mudo ?? p.mudo,
        tela: antigo?.tela ?? p.tela,
      };
      const { error } = await bd.from(TABELA).upsert(
        {
          sala,
          id: registrado.id,
          nome: registrado.nome,
          mudo: registrado.mudo,
          tela: registrado.tela,
          conexao: registrado.conexao,
          visto_em: new Date().toISOString(),
        },
        { onConflict: "sala,id" },
      );
      if (error) return { erro: `não consegui entrar na sala: ${error.message}` };

      const participantes = atual.filter((o) => o.id !== p.id).concat(registrado);
      return { participantes, jaEstava: Boolean(antigo) };
    },

    async sair(sala, id, conexao) {
      // A conexão velha da mesma aba não apaga a nova: a remoção só vale se a
      // linha ainda for **desta** conexão. Comparar dentro do próprio comando
      // evita a corrida entre ler e apagar.
      let consulta = bd.from(TABELA).delete().eq("sala", sala).eq("id", id);
      if (conexao) consulta = consulta.eq("conexao", conexao);
      const { data, error } = await consulta.select("id");
      if (error) return false;
      return (data ?? []).length > 0;
    },

    async atualizar(sala, id, campos) {
      const { data, error } = await bd
        .from(TABELA)
        .update(campos)
        .eq("sala", sala)
        .eq("id", id)
        .select("mudo, tela");
      if (error || !data?.[0]) return { mudo: false, tela: false };
      return { mudo: data[0].mudo, tela: data[0].tela };
    },

    listar,
    varrer,

    async publicar(sala, msg) {
      const c = canais.get(sala);
      if (!c) return;
      await c.send({ type: "broadcast", event: "nv", payload: msg });
    },

    async assinar(sala, entregar) {
      if (canais.has(sala)) return;
      // `self: true` é essencial: sem ele, a instância que publica não recebe
      // a própria mensagem de volta, e quem estivesse **nela** ficaria sem o
      // recado — a sala funcionaria só entre instâncias diferentes, que é o
      // avesso do defeito que este registro existe para resolver.
      const c = bd.channel(canal(sala), { config: { broadcast: { self: true } } });
      c.on("broadcast", { event: "nv" }, ({ payload }) => entregar(payload));
      canais.set(sala, c);
      await new Promise((pronto) => {
        c.subscribe((estado) => {
          if (estado === "SUBSCRIBED") pronto();
        });
        // Não vale travar a entrada de alguém por causa do canal: se ele
        // demorar, a pessoa entra e as mensagens começam a chegar quando
        // chegarem.
        setTimeout(pronto, 3000);
      });
    },

    async desassinar(sala) {
      const c = canais.get(sala);
      if (!c) return;
      canais.delete(sala);
      ultimaVarredura.delete(sala);
      await bd.removeChannel(c);
    },

    async tocar(sala, id) {
      await bd
        .from(TABELA)
        .update({ visto_em: new Date().toISOString() })
        .eq("sala", sala)
        .eq("id", id);
    },

    async encerrar() {
      for (const c of canais.values()) await bd.removeChannel(c);
      canais.clear();
    },
  };
}
