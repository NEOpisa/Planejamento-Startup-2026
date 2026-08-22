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
 * Quanto a conexão pode durar.
 *
 * O teto real é o do plano; pedir o máximo aqui só evita que ela caia antes
 * disso à toa. Cair não é problema: o cliente volta sozinho e, como o
 * participante é identificado pela aba, ninguém do outro lado percebe.
 */
export const maxDuration = 300;

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

/**
 * O diagnóstico — e por que ele **fala com o banco**.
 *
 * Conferir só se a variável de ambiente existe responde a pergunta errada. A
 * credencial pode estar lá e a tabela não existir; o endereço pode estar
 * certo e a chave ser de outro projeto. Em todos esses casos a sala abre, o
 * nome aparece e ninguém nunca chega — e é impossível descobrir por quê de
 * fora. Uma consulta de uma linha aqui responde a pergunta que se está
 * fazendo de verdade: **isto vai funcionar?**
 */
/**
 * A prova: uma sessão de mentira, ponta a ponta, dentro da própria função.
 *
 * O diagnóstico anterior dizia se o banco respondia. Não é a mesma pergunta
 * que "entrar numa sala funciona": entre uma coisa e outra estão a varredura,
 * o cadastro, a assinatura do canal e o envio da resposta — e foi exatamente
 * aí que a sala travou uma vez, com o socket abrindo e o servidor nunca
 * respondendo. De fora não havia como ver.
 *
 * Aqui um WebSocket de mentira entra numa sala descartável e conta o que
 * recebeu de volta. É a mesma estrada da pessoa de verdade, percorrida por
 * uma requisição HTTP comum.
 */
async function provar() {
  const recebido: { tipo: string }[] = [];
  const fingido = {
    readyState: 1,
    send: (dados: string) => recebido.push(JSON.parse(dados)),
    close: () => {},
  };
  const sala = `prova-${Math.random().toString(36).slice(2, 8)}`;
  const sessao = obter().aoConectar(fingido as never);

  await sessao.aoReceber(
    JSON.stringify({ tipo: "entrar", sala, nome: "prova", sessao: "prova-1" }),
  );
  const bemvindo = recebido.find((m) => m.tipo === "bemvindo");
  const erro = recebido.find((m) => m.tipo === "erro") as
    | { motivo?: string }
    | undefined;

  // não deixa lixo na sala de ninguém
  await sessao.aoReceber(JSON.stringify({ tipo: "sair" })).catch(() => {});
  await sessao.aoFechar().catch(() => {});

  if (bemvindo) return { entrar: "funciona" };
  if (erro) return { entrar: "recusado", motivo: erro.motivo };
  return {
    entrar: "sem resposta",
    motivo:
      "o servidor montou a sala e não devolveu nada. Se isto aparecer, o " +
      "problema está entre a sinalização e o WebSocket desta hospedagem.",
  };
}

/**
 * Qual código está no ar.
 *
 * Sem isto, "não funcionou" e "a correção subiu?" são duas perguntas que se
 * confundem — e a Vercel tem um botão de *Redeploy* que republica **aquele**
 * deploy, não o commit mais novo, o que é fácil de fazer sem perceber. Sete
 * caracteres aqui encerram o assunto.
 */
function versao() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : "local";
}

async function diagnosticar() {
  const supabase = acharSupabase();
  const redis = acharRedis();

  if (supabase) {
    try {
      const { criarRegistroSupabase } = await import("@/lib/registro-supabase.mjs");
      const registro = criarRegistroSupabase(supabase.url, supabase.chave);
      await registro.listar("diagnostico");
      return {
        versao: versao(),
        sinalizacao: "de pé",
        salas: "no supabase, compartilhadas entre as instâncias",
        ...(await provar()),
      };
    } catch (erro) {
      const motivo = String((erro as Error)?.message ?? erro);
      const semTabela = /nvdisc_participantes|schema cache|does not exist|42P01/i.test(motivo);
      return {
        versao: versao(),
        sinalizacao: "de pé",
        salas: "o supabase respondeu, mas a sala não pôde ser lida",
        erro: motivo,
        comoResolver: semTabela
          ? "rode o supabase/nvdisc.sql uma vez no SQL Editor do projeto: a tabela ainda não existe."
          : "confira SUPABASE_URL e SUPABASE_SECRET_KEY — a chave precisa ser a secreta deste projeto.",
      };
    }
  }

  if (redis) {
    return {
      versao: versao(),
      sinalizacao: "de pé",
      salas: "no redis, compartilhadas entre as instâncias",
      ...(await provar()),
    };
  }

  return {
    versao: versao(),
    sinalizacao: "de pé",
    salas: "cada instância com a sua — duas pessoas podem não se ver",
    comoResolver:
      "defina SUPABASE_URL e SUPABASE_SECRET_KEY (ou um REDIS_URL) nas " +
      "variáveis de ambiente do projeto, e rode supabase/nvdisc.sql uma vez.",
  };
}

export async function GET(requisicao: Request) {
  // Aberto no navegador (sem `Upgrade`), este endereço vira um diagnóstico.
  // Sem ele, a única forma de saber se o Redis foi encontrado seria caçar uma
  // linha no log da função — e a pergunta "será que pegou?" aparece toda vez
  // que alguém publica isto num lugar novo.
  if ((requisicao.headers.get("upgrade") ?? "").toLowerCase() !== "websocket") {
    return Response.json(await diagnosticar());
  }

  const sessaoDe = obter();
  return experimental_upgradeWebSocket((ws) => {
    const sessao = sessaoDe.aoConectar(
      ws as unknown as { readyState: number; send: (d: string) => void },
    );

    // Um sinal de vida assim que a conexão sobe.
    //
    // O cliente ignora um `pong` que não pediu, e ele responde de graça a
    // pergunta que mais custou tempo aqui: **o envio funciona neste
    // embrulho?** Sem isto, "o servidor não respondeu" pode ser o envio, a
    // leitura da mensagem ou a montagem da sala, e não há como separar de
    // fora.
    try {
      (ws as unknown as { send: (d: string) => void }).send(
        JSON.stringify({ tipo: "pong" }),
      );
    } catch {
      /* se nem isto passa, o `on("error")` abaixo cuida */
    }

    ws.on("message", (dados) => {
      const texto = comoTexto(dados);
      // Uma mensagem que não abre como JSON é descartada em silêncio pelo
      // protocolo, e é o certo para lixo de verdade. Mas quando o **embrulho
      // da hospedagem** entrega a mensagem numa forma inesperada, o silêncio
      // vira um servidor que recebe tudo e não responde nada — e não há como
      // descobrir de fora. Então esta, e só esta, volta descrita.
      if (!texto.trimStart().startsWith("{")) {
        try {
          (ws as unknown as { send: (d: string) => void }).send(
            JSON.stringify({
              tipo: "erro",
              motivo:
                `a sinalização recebeu algo que não é uma mensagem: ` +
                `${descrever(dados)} → ${texto.slice(0, 60)}`,
            }),
          );
        } catch {
          /* nada a fazer */
        }
        return;
      }
      void sessao.aoReceber(texto);
    });
    ws.on("close", () => void sessao.aoFechar());
    ws.on("error", () => void sessao.aoFechar());

  });
}

/**
 * O que chegou pelo socket, como texto.
 *
 * `String(dados)` resolve para texto e para `Buffer`, e **estraga**
 * silenciosamente um `ArrayBuffer` (vira "[object ArrayBuffer]") — que é
 * como alguns embrulhos entregam a mesma mensagem. O JSON não abre, a
 * mensagem é descartada como lixo, e o resultado é um servidor que recebe
 * tudo e não responde nada.
 */
function comoTexto(dados: unknown): string {
  if (typeof dados === "string") return dados;
  // Embrulho no estilo do navegador: o que interessa vem dentro de `.data`.
  if (dados && typeof dados === "object" && "data" in (dados as object)) {
    return comoTexto((dados as { data: unknown }).data);
  }
  if (Array.isArray(dados)) return Buffer.concat(dados as Uint8Array[]).toString("utf8");
  if (Buffer.isBuffer(dados)) return dados.toString("utf8");
  if (dados instanceof ArrayBuffer) return Buffer.from(dados).toString("utf8");
  if (ArrayBuffer.isView(dados)) {
    const v = dados as ArrayBufferView;
    return Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("utf8");
  }
  return String(dados);
}

/** Como descrever o que chegou, para a mensagem de erro fazer sentido. */
function descrever(dados: unknown): string {
  if (dados === null || dados === undefined) return String(dados);
  const tipo = typeof dados;
  if (tipo !== "object") return tipo;
  const nome = (dados as object).constructor?.name ?? "objeto";
  const chaves = Object.keys(dados as object).slice(0, 5).join(",");
  return chaves ? `${nome}{${chaves}}` : nome;
}
