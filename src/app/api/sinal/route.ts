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
import { criarRegistroSupabase } from "@/lib/registro-supabase.mjs";
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

/**
 * Onde está o Supabase.
 *
 * Mesma ideia do Redis: os nomes variam conforme quem configurou (a
 * integração oficial usa `SUPABASE_URL`, quem faz na mão às vezes chama de
 * `NEXT_PUBLIC_SUPABASE_URL`), então o endereço é procurado pelo formato e a
 * chave pelo prefixo.
 *
 * A chave tem de ser a **secreta** (`sb_secret_…` ou a `service_role`). A
 * pública não serve: a tabela é fechada por RLS de propósito, e quem fala com
 * ela é a função, nunca o navegador.
 */
function acharSupabase() {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    Object.values(process.env).find((v) => v && /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(v));
  const nomesDeChave = [
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_KEY",
  ];
  let chave = nomesDeChave.map((n) => process.env[n]).find(Boolean);
  if (!chave) {
    chave = Object.entries(process.env).find(
      ([nome, v]) => v?.startsWith("sb_secret_") && !nome.startsWith("NEXT_PUBLIC_"),
    )?.[1];
  }
  return url && chave ? { url, chave } : null;
}

function obter() {
  if (sinalizacao) return sinalizacao;

  // A ordem é a do trabalho que dá para quem hospeda: o que estiver
  // configurado vale, e o Supabase vem primeiro por ser o que este projeto
  // usa hoje. Trocar de um para o outro é mexer em variável de ambiente, não
  // em código.
  const supabase = acharSupabase();
  if (supabase) {
    sinalizacao = criarSinalizacao(criarRegistroSupabase(supabase.url, supabase.chave));
    return sinalizacao;
  }

  const redis = acharRedis();
  if (redis) {
    sinalizacao = criarSinalizacao(criarRegistroRedis(redis));
    return sinalizacao;
  }

  // Sem nenhum dos dois a sala funciona **por acidente**: só enquanto todas
  // as conexões caírem na mesma instância. É melhor que nada numa prévia, e é
  // preciso dizer alto que não serve para valer.
  console.warn(
    "NVDISC: sem Supabase e sem Redis configurados. A sala vai funcionar só " +
      "enquanto todo mundo cair na mesma instância da função — ou seja, às " +
      "vezes. Veja 'Na Vercel' no README.",
  );
  sinalizacao = criarSinalizacao(criarRegistroMemoria());
  return sinalizacao;
}

export async function GET(requisicao: Request) {
  // Aberto no navegador (sem `Upgrade`), este endereço vira um diagnóstico.
  // Sem ele, a única forma de saber se o Redis foi encontrado seria caçar uma
  // linha no log da função — e a pergunta "será que pegou?" aparece toda vez
  // que alguém publica isto num lugar novo.
  if ((requisicao.headers.get("upgrade") ?? "").toLowerCase() !== "websocket") {
    const supabase = acharSupabase();
    const redis = acharRedis();
    const onde = supabase ? "supabase" : redis ? "redis" : null;
    return Response.json({
      sinalizacao: "de pé",
      salas: onde
        ? `no ${onde}, compartilhadas entre as instâncias`
        : "cada instância com a sua — duas pessoas podem não se ver",
      comoResolver: onde
        ? undefined
        : "defina SUPABASE_URL e SUPABASE_SECRET_KEY (ou um REDIS_URL) nas " +
          "variáveis de ambiente do projeto, e rode supabase/nvdisc.sql uma vez.",
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
