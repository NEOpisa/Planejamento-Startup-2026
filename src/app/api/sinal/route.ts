/**
 * A sinalização na Vercel.
 *
 * O `server.mjs` continua sendo a casa natural do NVDISC — um processo só,
 * servindo tudo. Esta rota existe para quando a central mora numa hospedagem
 * sem processo: a Vercel passou a aceitar WebSocket em função (junho de 2026),
 * e é por aqui que ele entra.
 *
 * Duas coisas mudam em relação ao servidor próprio, e as duas já estão
 * resolvidas fora daqui:
 *
 * 1. **A lista de quem está na sala não pode viver na memória** — conexões da
 *    mesma sala podem cair em instâncias diferentes. Ela vive no Redis
 *    (`registro-redis.mjs`).
 * 2. **A conexão morre no teto de duração da função** (cinco minutos, no
 *    padrão). O cliente reconecta sozinho, e como o identificador de cada
 *    participante é a aba — não a conexão —, para os outros não acontece
 *    nada: ninguém sai, ninguém entra, e a voz, que vai direto entre os
 *    navegadores, nem fica sabendo.
 *
 * O caminho público continua sendo `/NVDISC/sinal`: um `rewrite` no
 * `next.config.ts` traz para cá. É o mesmo endereço do servidor próprio, então
 * o cliente não precisa saber onde está rodando.
 */

import { experimental_upgradeWebSocket } from "@vercel/functions";

import { criarSinalizacao } from "@/lib/sinalizacao.mjs";
import { criarRegistroRedis } from "@/lib/registro-redis.mjs";
import { criarRegistroMemoria } from "@/lib/registro-memoria.mjs";

export const dynamic = "force-dynamic";
/** Sem Node não há `ws` nem conexão TCP com o Redis. */
export const runtime = "nodejs";

/**
 * Um registro por instância, reaproveitado entre conexões.
 *
 * Com Fluid compute a instância atende várias conexões e sobrevive entre
 * requisições, então abrir um Redis por conexão seria desperdiçar o limite de
 * conexões do banco em poucos minutos de uso.
 */
let sinalizacao: ReturnType<typeof criarSinalizacao> | null = null;

/**
 * Onde está o Redis.
 *
 * O nome da variável depende de quem provisionou: `REDIS_URL` no caso comum,
 * `KV_URL` no que sobrou do Vercel KV, e cada provedor do Marketplace tem o
 * seu (`UPSTASH_REDIS_URL`, `REDIS_URL_TLS`, e por aí vai). Procurar pelo
 * **formato** em vez de pelo nome evita a tarde inteira de "adicionei o Redis
 * e continua sem funcionar" por causa de um nome que ninguém tinha como
 * adivinhar.
 */
function acharRedis() {
  const preferidas = ["REDIS_URL", "KV_URL", "UPSTASH_REDIS_URL"];
  for (const nome of preferidas) {
    const v = process.env[nome];
    if (v && /^rediss?:\/\//.test(v)) return v;
  }
  for (const [, v] of Object.entries(process.env)) {
    if (v && /^rediss?:\/\//.test(v)) return v;
  }
  return null;
}

function obter() {
  if (sinalizacao) return sinalizacao;
  const url = acharRedis();
  if (!url) {
    // Sem Redis a sala funciona **por acidente**: só enquanto todas as
    // conexões caírem na mesma instância. É melhor que nada em uma prévia,
    // e é preciso dizer alto que não serve para valer.
    console.warn(
      "NVDISC: nenhuma variável de ambiente com um endereço redis:// foi " +
        "encontrada. A sala vai funcionar só enquanto todo mundo cair na mesma " +
        "instância da função — ou seja, às vezes. Adicione um Redis ao projeto " +
        "(Vercel → Storage → Marketplace → Redis) ou defina REDIS_URL na mão.",
    );
    sinalizacao = criarSinalizacao(criarRegistroMemoria());
    return sinalizacao;
  }
  sinalizacao = criarSinalizacao(criarRegistroRedis(url));
  return sinalizacao;
}

export async function GET(requisicao: Request) {
  // Aberto no navegador (sem `Upgrade`), este endereço vira um diagnóstico.
  // Sem ele, a única forma de saber se o Redis foi encontrado seria caçar uma
  // linha no log da função — e a pergunta "será que pegou?" aparece toda vez
  // que alguém publica isto num lugar novo.
  if ((requisicao.headers.get("upgrade") ?? "").toLowerCase() !== "websocket") {
    const url = acharRedis();
    return Response.json({
      sinalizacao: "de pé",
      redis: url ? "encontrado" : "ausente",
      salas: url
        ? "compartilhadas entre as instâncias"
        : "cada instância com a sua — duas pessoas podem não se ver",
      comoResolver: url
        ? undefined
        : "Vercel → Storage → Marketplace → um Redis; ou defina REDIS_URL nas variáveis de ambiente do projeto.",
    });
  }

  const sessaoDe = obter();
  return experimental_upgradeWebSocket((ws) => {
    const sessao = sessaoDe.aoConectar(ws as unknown as { readyState: number; send: (d: string) => void });
    ws.on("message", (dados) => void sessao.aoReceber(String(dados)));
    ws.on("close", () => void sessao.aoFechar());
    ws.on("error", () => void sessao.aoFechar());
  });
}
