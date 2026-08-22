/**
 * Teste do arranjo da Vercel — duas instâncias, uma sala.
 *
 *     REDIS_URL=redis://localhost:6379 npm run test:redis
 *
 * O `npm test` sobe **um** servidor e confere o protocolo. Isso não prova
 * nada sobre a Vercel, onde duas pessoas da mesma sala podem cair em
 * instâncias diferentes da função — e onde uma lista de participantes em
 * memória viraria duas listas, cada pessoa sozinha na sua, sem erro nenhum
 * em lugar nenhum.
 *
 * Aqui sobem **dois** processos com o registro em Redis, um cliente em cada,
 * e se confere o que só esse arranjo pode responder: eles se veem? o chat
 * atravessa? o sinal do WebRTC chega a quem devia? quem volta continua sendo
 * a mesma pessoa?
 *
 * Sem `REDIS_URL` o teste não roda — e diz como subir um.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { WebSocket } from "ws";

const URL_REDIS = process.env.REDIS_URL;
if (!URL_REDIS) {
  console.log(
    "\nEste teste precisa de um Redis. Um jeito rápido:\n\n" +
      "  docker run --rm -p 6379:6379 redis:7-alpine\n\n" +
      "e então:\n\n" +
      "  REDIS_URL=redis://localhost:6379 npm run test:redis\n",
  );
  process.exit(0);
}

let passou = 0;
let falhou = 0;
const ok = (c, d, extra = "") => {
  if (c) {
    passou += 1;
    console.log(`  \x1b[38;2;79;209;160m✓\x1b[0m ${d}`);
  } else {
    falhou += 1;
    console.log(`  \x1b[38;2;242;101;122m✗\x1b[0m ${d}${extra ? ` — ${extra}` : ""}`);
  }
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Uma "instância da função": um processo com o mesmo protocolo e o mesmo Redis. */
function instancia(porta) {
  const codigo = `
    import { WebSocketServer } from "ws";
    import { criarSinalizacao } from "${new URL("../src/lib/sinalizacao.mjs", import.meta.url).pathname}";
    import { criarRegistroRedis } from "${new URL("../src/lib/registro-redis.mjs", import.meta.url).pathname}";
    const sinalizacao = criarSinalizacao(criarRegistroRedis(process.env.REDIS_URL));
    const wss = new WebSocketServer({ port: ${porta} });
    wss.on("connection", (ws) => {
      const s = sinalizacao.aoConectar(ws);
      ws.on("message", (b) => void s.aoReceber(b));
      ws.on("close", () => void s.aoFechar());
    });
    wss.on("listening", () => console.log("pronta"));
  `;
  const p = spawn("node", ["--input-type=module", "-e", codigo], {
    // Prazos curtos: o teste precisa ver a varredura acontecer, e esperar os
    // setenta segundos de produção seria um minuto parado por rodada.
    env: {
      ...process.env,
      REDIS_URL: URL_REDIS,
      // Curtos o bastante para o teste ver a varredura, largos o bastante
      // para não varrer quem está vivo: a proporção entre eles é a mesma da
      // produção (batimento a cada 20 s, validade de 70 s).
      NVDISC_VALIDADE_MS: "9000",
      NVDISC_MANUTENCAO_MS: "700",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let saida = "";
  p.stdout.on("data", (d) => (saida += d));
  p.stderr.on("data", (d) => (saida += d));
  p.pronta = async () => {
    const prazo = Date.now() + 15_000;
    while (!saida.includes("pronta") && Date.now() < prazo) await esperar(150);
    if (!saida.includes("pronta")) throw new Error(`instância ${porta} não subiu: ${saida}`);
  };
  p.saida = () => saida;
  return p;
}

/** Um cliente ligado a UMA das instâncias. */
function cliente(porta, sala, nome, sessao) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${porta}`);
    ws.recebido = [];
    ws.on("message", (b) => {
      const m = JSON.parse(b);
      ws.recebido.push(m);
      if (m.tipo === "bemvindo") ws.meuId = m.voceId;
    });
    ws.on("open", () => {
      ws.send(JSON.stringify({ tipo: "entrar", sala, nome, sessao }));
      setTimeout(() => resolve(ws), 400);
    });
    ws.on("error", () => resolve(ws));
  });
}

const de = (ws, tipo) => ws.recebido.filter((m) => m.tipo === tipo);

const A = instancia(4401);
const B = instancia(4402);
try {
  await A.pronta();
  await B.pronta();

  const sala = "vercel-" + Math.random().toString(36).slice(2, 7);
  console.log("\nduas instâncias, uma sala");
  const ana = await cliente(4401, sala, "Ana", "aba-ana");
  const bia = await cliente(4402, sala, "Bia", "aba-bia");
  await esperar(600);

  ok(de(ana, "bemvindo").length === 1, "a Ana entrou pela instância 1");
  ok(de(bia, "bemvindo")[0]?.participantes.length === 1, "a Bia, pela instância 2, já vê a Ana");
  ok(
    de(ana, "entrou")[0]?.nome === "Bia",
    "e a Ana é avisada da chegada da Bia, que está no outro processo",
  );

  console.log("\nchat entre instâncias");
  bia.send(JSON.stringify({ tipo: "chat", texto: "atravessou?" }));
  await esperar(500);
  ok(de(ana, "chat")[0]?.texto === "atravessou?", "a mensagem cruza de uma instância para a outra");
  ok(de(bia, "chat").length === 1, "e volta para quem escreveu");

  console.log("\nsinal do WebRTC");
  ana.send(JSON.stringify({ tipo: "sinal", para: bia.meuId, dados: { oferta: 1 } }));
  await esperar(500);
  ok(de(bia, "sinal")[0]?.dados?.oferta === 1, "o sinal chega a quem era destinado");
  ok(de(bia, "sinal")[0]?.de === ana.meuId, "com a origem carimbada pelo servidor");
  ok(de(ana, "sinal").length === 0, "e não sobra cópia para quem mandou");

  console.log("\nestado");
  bia.send(JSON.stringify({ tipo: "estado", mudo: true, tela: false }));
  await esperar(500);
  ok(de(ana, "estado")[0]?.mudo === true, "o microfone desligado atravessa");

  console.log("\na conexão que cai no teto da função");
  // É o que a Vercel faz de cinco em cinco minutos: derruba e o cliente volta.
  const antesEntrou = de(ana, "entrou").length;
  const antesSaiu = de(ana, "saiu").length;
  bia.close();
  await esperar(400);
  const bia2 = await cliente(4402, sala, "Bia", "aba-bia");
  await esperar(600);

  ok(bia2.meuId === bia.meuId, "quem volta continua sendo a mesma pessoa", `${bia.meuId} ≠ ${bia2.meuId}`);
  ok(
    de(ana, "entrou").length === antesEntrou && de(ana, "saiu").length === antesSaiu,
    "e para quem ficou não acontece nada: ninguém sai, ninguém entra",
    `entrou +${de(ana, "entrou").length - antesEntrou}, saiu +${de(ana, "saiu").length - antesSaiu}`,
  );
  ok(
    de(bia2, "bemvindo")[0]?.participantes.some((p) => p.nome === "Ana"),
    "e quem volta reencontra a sala como ela estava",
  );

  console.log("\na instância que morre sem avisar");
  // O caso que só existe em hospedagem serverless: a instância que atendia
  // alguém é encerrada sem executar o fechamento das conexões. Ninguém tira
  // aquela pessoa da lista, e os outros ficam falando com um fantasma. É o
  // batimento que resolve — quem para de bater é varrido por quem continua.
  const fantasma = await cliente(4402, sala, "Fantasma", "aba-fantasma");
  await esperar(600);
  ok(
    de(ana, "entrou").some((m) => m.nome === "Fantasma"),
    "o fantasma entrou na sala",
  );
  const saiuAntes = de(ana, "saiu").length;
  // `terminate` corta o TCP sem fechar nada: é o mais perto de "a instância
  // morreu" que dá para simular de fora.
  fantasma.terminate();
  // Os vivos continuam batendo — é o batimento deles que dispara a varredura,
  // e é o que o cliente de verdade faz de vinte em vinte segundos.
  for (let i = 0; i < 22; i += 1) {
    ana.send(JSON.stringify({ tipo: "ping" }));
    bia2.send(JSON.stringify({ tipo: "ping" }));
    await esperar(600);
  }
  ok(
    de(ana, "saiu").length > saiuAntes,
    "quem para de dar sinal de vida é varrido da sala",
    `${de(ana, "saiu").length - saiuAntes} saída(s) anunciada(s)`,
  );

  console.log("\nsaída de verdade");
  // O cliente avisa antes de fechar; é esse aviso que separa "fechei a aba"
  // de "a função me cortou e eu já volto".
  const saiuAntesDaDespedida = de(ana, "saiu").length;
  bia2.send(JSON.stringify({ tipo: "sair" }));
  await esperar(800);
  ok(
    de(ana, "saiu").length === saiuAntesDaDespedida + 1,
    "quem avisa que está saindo é anunciado uma vez só, do outro processo",
    `${de(ana, "saiu").length - saiuAntesDaDespedida} anúncio(s)`,
  );

  ana.close();
} finally {
  A.kill("SIGTERM");
  B.kill("SIGTERM");
  await esperar(300);
}

console.log(
  `\n${falhou === 0 ? "\x1b[38;2;79;209;160m" : "\x1b[38;2;242;101;122m"}` +
    `${passou} passaram, ${falhou} falharam\x1b[0m\n`,
);
process.exit(falhou === 0 ? 0 : 1);
