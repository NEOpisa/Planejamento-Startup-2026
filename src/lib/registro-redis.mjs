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

/** Quanto tempo sem batimento até alguém ser considerado morto. */
const VALIDADE = 70_000;
/** Uma sala inteira sem ninguém tocar some do Redis. */
const VALIDADE_SALA = 3600;

const chave = (sala) => `nvdisc:sala:${sala}`;
const chaveVivos = (sala) => `nvdisc:sala:${sala}:vivos`;
const canal = (sala) => `nvdisc:canal:${sala}`;

export function criarRegistroRedis(url) {
  const escrita = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
  // O Redis não aceita comandos numa conexão que está ouvindo canais: quem
  // assina só assina. Daí a segunda conexão.
  const escuta = escrita.duplicate();
  const entregadores = new Map();

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
  async function varrer(sala) {
    const corte = Date.now() - VALIDADE;
    const mortos = await escrita.zrangebyscore(chaveVivos(sala), "-inf", corte);
    if (mortos.length === 0) return [];
    await escrita
      .multi()
      .zrem(chaveVivos(sala), ...mortos)
      .hdel(chave(sala), ...mortos)
      .exec();
    return mortos;
  }

  async function lista(sala) {
    const bruto = await escrita.hgetall(chave(sala));
    return Object.values(bruto).map((v) => JSON.parse(v));
  }

  return {
    nome: "redis",

    async entrar(sala, p) {
      await varrer(sala);
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
      await escrita
        .multi()
        .zadd(chaveVivos(sala), Date.now(), id)
        .expire(chave(sala), VALIDADE_SALA)
        .expire(chaveVivos(sala), VALIDADE_SALA)
        .exec();
    },

    async encerrar() {
      escuta.disconnect();
      escrita.disconnect();
    },
  };
}
