/**
 * As salas no Redis — o registro para quando não existe "este processo".
 *
 * Na Vercel cada conexão pode cair numa instância diferente da função, e não
 * há como escolher. Uma lista de participantes em memória viraria, na prática,
 * várias listas: duas pessoas na mesma sala, cada uma numa instância, nunca se
 * veriam. O sintoma é o pior possível — a sala abre, o nome aparece e ninguém
 * chega — e ele some e volta conforme o roteamento, o que torna o defeito
 * quase impossível de perseguir sem saber disto de antemão.
 *
 * Então a lista mora fora, e as instâncias conversam por publicação:
 *
 * - `sala:{código}` (hash)  — quem está na sala, um campo por participante;
 * - `sala:{código}:vivos` (zset) — quando cada um deu sinal de vida;
 * - canal `sala:{código}` — por onde as mensagens atravessam de uma instância
 *   para as outras.
 *
 * O conjunto ordenado existe porque conexão morta nem sempre avisa: se a
 * instância que atendia alguém for encerrada, ninguém remove aquela pessoa da
 * lista. O batimento do cliente (o `ping` de vinte em vinte segundos) atualiza
 * a marca, e quem passa de `VALIDADE` sem tocar é varrido por quem chegar
 * depois — a sala se limpa sozinha, sem tarefa agendada, que numa hospedagem
 * serverless também não haveria onde rodar.
 */

import Redis from "ioredis";

import { LIMITES } from "./protocolo.mjs";

/**
 * Quanto tempo sem batimento até alguém ser considerado morto.
 *
 * O cliente bate de vinte em vinte segundos, então setenta dá margem para
 * duas batidas perdidas antes de alguém sumir da sala por engano. As duas
 * variáveis de ambiente existem para o teste poder trabalhar em segundos em
 * vez de esperar um minuto — em produção ninguém as define.
 */
const VALIDADE = Number(process.env.NVDISC_VALIDADE_MS ?? 70_000);
/** Uma sala inteira sem ninguém tocar some do Redis. */
const VALIDADE_SALA = 3600;
/**
 * De quanto em quanto tempo vale renovar a validade da sala e varrer os
 * mortos.
 *
 * O batimento de cada pessoa chega de vinte em vinte segundos, e fazer as
 * três operações em todos eles gastaria o plano gratuito de um provedor
 * pequeno à toa: são comandos cobrados, e ninguém morre por ser varrido meio
 * minuto depois. O que **não** pode atrasar é a marca de vida em si — essa
 * vai sempre, e é um comando só.
 */
const INTERVALO_MANUTENCAO = Number(process.env.NVDISC_MANUTENCAO_MS ?? 45_000);

const chave = (sala) => `nvdisc:sala:${sala}`;
const chaveVivos = (sala) => `nvdisc:sala:${sala}:vivos`;
const canal = (sala) => `nvdisc:canal:${sala}`;

export function criarRegistroRedis(url) {
  const escrita = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
  // O Redis não aceita comandos numa conexão que está ouvindo canais: quem
  // assina só assina. Daí a segunda conexão.
  const escuta = escrita.duplicate();
  const entregadores = new Map();
  /**
   * Dois relógios, e não um: a varredura e a renovação de validade são
   * chamadas em sequência no mesmo batimento, e um relógio só faria a
   * primeira consumir a vez da segunda — a varredura simplesmente nunca
   * aconteceria, e os fantasmas ficariam.
   */
  const relogios = { varredura: new Map(), validade: new Map() };

  function passouDaHora(qual, sala) {
    const agora = Date.now();
    const mapa = relogios[qual];
    if (agora - (mapa.get(sala) ?? 0) < INTERVALO_MANUTENCAO) return false;
    mapa.set(sala, agora);
    return true;
  }

  escuta.on("message", (nome, bruto) => {
    const entregar = entregadores.get(nome);
    if (!entregar) return;
    try {
      entregar(JSON.parse(bruto));
    } catch {
      /* mensagem estranha no canal: ignora */
    }
  });

  /**
   * Tira da sala quem parou de dar sinal de vida, e diz quem tirou.
   *
   * É a rede de segurança para a instância que morre sem fechar as conexões:
   * ninguém executa o `close`, e sem isto aquelas pessoas ficariam na lista
   * para sempre, com os outros tentando falar com fantasmas.
   */
  async function varrer(sala, sempre = false) {
    if (!sempre && !passouDaHora("varredura", sala)) return [];
    const corte = Date.now() - VALIDADE;
    const candidatos = await escrita.zrangebyscore(chaveVivos(sala), "-inf", corte);
    if (candidatos.length === 0) return [];

    // Um de cada vez, e o `ZREM` decide quem anuncia.
    //
    // Todas as instâncias varrem, e todas veem os mesmos mortos: removendo em
    // bloco, cada uma acharia que tirou aquela pessoa da sala e a saída seria
    // anunciada várias vezes. O `ZREM` devolve quantos membros removeu de
    // fato — quem receber 1 foi quem chegou primeiro, e só esse conta.
    const removidos = [];
    for (const id of candidatos) {
      const tirou = await escrita.zrem(chaveVivos(sala), id);
      if (tirou !== 1) continue;
      await escrita.hdel(chave(sala), id);
      removidos.push(id);
    }
    return removidos;
  }

  async function lista(sala) {
    const bruto = await escrita.hgetall(chave(sala));
    return Object.values(bruto).map((v) => JSON.parse(v));
  }

  return {
    nome: "redis",

    async entrar(sala, p) {
      // Na entrada a varredura vale sempre: é o momento em que a lista é lida
      // por inteiro, e uma lista com fantasma é o que o recém-chegado veria.
      await varrer(sala, true);
      const atual = await lista(sala);
      const antigo = atual.find((o) => o.id === p.id);

      if (!antigo && atual.length >= LIMITES.POR_SALA) {
        return {
          erro:
            `esta sala já está com ${LIMITES.POR_SALA} pessoas, que é o limite. ` +
            `A conversa é direta entre os navegadores, e acima disso a conexão de ` +
            `quem tem internet mais fraca começa a sofrer.`,
        };
      }

      // Quem volta mantém o que já havia dito sobre si (microfone, tela).
      const registrado = {
        ...p,
        mudo: antigo?.mudo ?? p.mudo,
        tela: antigo?.tela ?? p.tela,
      };
      await escrita
        .multi()
        .hset(chave(sala), p.id, JSON.stringify(registrado))
        .zadd(chaveVivos(sala), Date.now(), p.id)
        .expire(chave(sala), VALIDADE_SALA)
        .expire(chaveVivos(sala), VALIDADE_SALA)
        .exec();

      const participantes = atual.filter((o) => o.id !== p.id).concat(registrado);
      return { participantes, jaEstava: Boolean(antigo) };
    },

    async sair(sala, id, conexao) {
      const bruto = await escrita.hget(chave(sala), id);
      if (!bruto) return false;
      // A conexão velha da mesma aba não apaga a nova.
      const p = JSON.parse(bruto);
      if (conexao && p.conexao !== conexao) return false;
      await escrita.multi().hdel(chave(sala), id).zrem(chaveVivos(sala), id).exec();
      return true;
    },

    async atualizar(sala, id, campos) {
      const bruto = await escrita.hget(chave(sala), id);
      if (!bruto) return { mudo: false, tela: false };
      const p = { ...JSON.parse(bruto), ...campos };
      await escrita.hset(chave(sala), id, JSON.stringify(p));
      return { mudo: p.mudo, tela: p.tela };
    },

    listar: lista,

    async publicar(sala, msg) {
      await escrita.publish(canal(sala), JSON.stringify(msg));
    },

    async assinar(sala, entregar) {
      entregadores.set(canal(sala), entregar);
      await escuta.subscribe(canal(sala));
    },

    async desassinar(sala) {
      entregadores.delete(canal(sala));
      await escuta.unsubscribe(canal(sala)).catch(() => {});
    },

    varrer,

    async tocar(sala, id) {
      // O comum é um comando só. A renovação da validade da sala anda junto
      // com a varredura, de tempos em tempos.
      if (passouDaHora("validade", sala)) {
        await escrita
          .multi()
          .zadd(chaveVivos(sala), Date.now(), id)
          .expire(chave(sala), VALIDADE_SALA)
          .expire(chaveVivos(sala), VALIDADE_SALA)
          .exec();
        return;
      }
      await escrita.zadd(chaveVivos(sala), Date.now(), id);
    },

    async encerrar() {
      escuta.disconnect();
      escrita.disconnect();
    },
  };
}
