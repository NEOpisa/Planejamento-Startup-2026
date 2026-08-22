/**
 * Teste de chamada de verdade — dois navegadores, uma sala.
 *
 *     npm run test:navegador
 *
 * O `npm test` cobre o servidor: quem entra, quem sai, o chat, os limites.
 * Nada disso prova que **a voz funciona**, porque a voz não passa pelo
 * servidor. Este teste abre dois Chrome de verdade (headless, com microfone
 * falso), põe os dois na mesma sala e confere o que só um navegador pode
 * responder: o WebRTC fechou? chegou faixa de áudio do outro lado? ela está
 * recebendo mídia?
 *
 * Foi escrevendo isto que apareceu o defeito mais grave que o projeto teve: o
 * fluxo remoto chegava e não estava ligado a nenhum elemento de áudio, então
 * a sala inteira era muda. Um teste que só falasse com o servidor jamais teria
 * visto.
 *
 * Precisa do Chrome. No Arch com Flatpak:
 *     flatpak install flathub com.google.Chrome
 */

import fs from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { WebSocket } from "ws";

import { BASE } from "../src/lib/base.mjs";

const PORTA = 3400;
/** O segundo servidor, em modo de desenvolvimento (ver o fim do arquivo). */
const PORTA_DEV = 3402;
const CDP = Number(process.env.CDP ?? 9333);
const RAIZ = `http://localhost:${PORTA}${BASE}`;
const SALA = "e2e-" + Math.random().toString(36).slice(2, 7);

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

// ------------------------------------------------------------- o CDP --

/** Cliente mínimo do Chrome DevTools Protocol. É JSON-RPC sobre WebSocket. */
async function abaCDP(url) {
  const ws = new WebSocket(url, { maxPayload: 64 * 1024 * 1024 });
  await once(ws, "open");
  let n = 0;
  const pendentes = new Map();
  ws.on("message", (bruto) => {
    const m = JSON.parse(bruto);
    if (m.id && pendentes.has(m.id)) {
      const { resolve, reject } = pendentes.get(m.id);
      pendentes.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    }
  });
  return {
    ws,
    chamar(metodo, params = {}) {
      const id = ++n;
      ws.send(JSON.stringify({ id, method: metodo, params }));
      return new Promise((resolve, reject) => {
        pendentes.set(id, { resolve, reject });
        setTimeout(() => {
          if (pendentes.delete(id)) reject(new Error(`${metodo} não respondeu`));
        }, 20_000);
      });
    },
    async js(expressao) {
      const r = await this.chamar("Runtime.evaluate", {
        expression: expressao,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) {
        // "Uncaught" sozinho não ajuda ninguém: o que interessa é a mensagem
        // e a linha, que ficam no objeto de exceção.
        const d = r.exceptionDetails;
        const detalhe =
          d.exception?.description ?? d.exception?.value ?? d.text ?? "erro";
        throw new Error(`${detalhe}  (linha ${d.lineNumber ?? "?"})`);
      }
      return r.result.value;
    },
    fechar() {
      try {
        ws.close();
      } catch {
        /* já fechado */
      }
    },
  };
}

async function novaAba(url) {
  const r = await fetch(`http://localhost:${CDP}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  const alvo = await r.json();
  return { alvo, aba: await abaCDP(alvo.webSocketDebuggerUrl) };
}

/**
 * Espera a aba chegar de fato na página.
 *
 * Criar a aba devolve na hora, mas o contexto de execução ainda pode ser o
 * `about:blank` inicial — e `localStorage` num `about:blank` **lança**. Sem
 * esta espera o teste falha com um "Uncaught" sem nome, que é o pior tipo de
 * erro: parece defeito do produto e é do teste.
 */
async function esperarPagina(aba, prefixo) {
  const ate = Date.now() + 20_000;
  while (Date.now() < ate) {
    try {
      const href = await aba.js("location.href");
      if (typeof href === "string" && href.startsWith(prefixo)) return true;
    } catch {
      /* contexto ainda trocando */
    }
    await esperar(300);
  }
  throw new Error(`a aba não chegou em ${prefixo}`);
}

async function fecharAba(id) {
  await fetch(`http://localhost:${CDP}/json/close/${id}`).catch(() => {});
}

// --------------------------------------------------------- preparação --

const temCDP = await fetch(`http://localhost:${CDP}/json/version`)
  .then((r) => r.ok)
  .catch(() => false);
if (!temCDP) {
  console.log(
    `\nEste teste precisa de um Chrome com depuração remota na porta ${CDP}:\n\n` +
      `  flatpak run --filesystem=/tmp com.google.Chrome \\\n` +
      `    --headless=new --disable-gpu --user-data-dir=/tmp/nvdisc-chrome \\\n` +
      `    --remote-debugging-port=${CDP} --use-fake-device-for-media-stream \\\n` +
      `    --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required \\\n` +
      `    about:blank &\n`,
  );
  process.exit(1);
}

console.log("\nsubindo o servidor…");
const servidor = spawn("node", ["server.mjs"], {
  env: { ...process.env, PORT: String(PORTA), NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
let saida = "";
servidor.stdout.on("data", (d) => (saida += d));
servidor.stderr.on("data", (d) => (saida += d));
const prazo = Date.now() + 30_000;
while (!saida.includes("NVDISC em") && Date.now() < prazo) await esperar(200);
if (!saida.includes("NVDISC em")) {
  console.log(saida);
  process.exit(1);
}

const abas = [];
try {
  // O nome vai pelo localStorage: é o mesmo caminho que a entrada usa, e
  // evita ter que dirigir um formulário do React pelo protocolo.
  for (const nome of ["Ana", "Bia"]) {
    const { alvo, aba } = await novaAba(`${RAIZ}/`);
    abas.push({ nome, alvo, aba });
    await aba.chamar("Runtime.enable");
    await aba.chamar("Page.enable");
    // Um gancho só de teste, injetado antes de qualquer script da página:
    // guarda cada RTCPeerConnection criada para o teste poder perguntar o
    // estado dela. Fica aqui, e não no produto — código de diagnóstico no
    // produto é código que alguém acaba usando.
    await aba.chamar("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const Orig = window.RTCPeerConnection;
        window.__pcs = [];
        window.RTCPeerConnection = function (...a) {
          const pc = new Orig(...a);
          window.__pcs.push(pc);
          return pc;
        };
        window.RTCPeerConnection.prototype = Orig.prototype;

        // Conta os AudioContext criados. Mais de um por participante foi a
        // causa do áudio travando: o Chrome permite ~6 por aba.
        const AC = window.AudioContext;
        window.__acs = 0;
        window.AudioContext = function (...b) {
          window.__acs += 1;
          return new AC(...b);
        };
        window.AudioContext.prototype = AC.prototype;
      })()`,
    });
    await esperarPagina(aba, RAIZ);
    await aba.js(`localStorage.setItem("nvdisc:nome", ${JSON.stringify(nome)})`);
    await aba.chamar("Page.navigate", { url: `${RAIZ}/sala/${SALA}` });
    await esperarPagina(aba, `${RAIZ}/sala/${SALA}`);
    await esperar(800);
  }

  console.log("\nesperando a chamada fechar…");
  // WebRTC leva alguns segundos: STUN, candidatos, handshake. Doze segundos é
  // folgado para localhost e continua rápido o bastante para um teste.
  // A sonda vem de um arquivo, lida como texto: dentro de um template
  // literal, `\n` e `\d` seriam reinterpretados antes de chegar ao navegador
  // (ver o cabeçalho de `sonda.js`).
  const sonda = fs.readFileSync(new URL("./sonda.js", import.meta.url), "utf8");

  let a = null;
  let b = null;
  const ate = Date.now() + 20_000;
  while (Date.now() < ate) {
    a = await abas[0].aba.js(sonda);
    b = await abas[1].aba.js(sonda);
    if (a.recebendo >= 1 && b.recebendo >= 1) break;
    await esperar(1000);
  }

  if (!(a.recebendo >= 1 && b.recebendo >= 1)) {
    console.log("\ndiagnóstico das conexões");
    console.log("  Ana:", JSON.stringify(a.conexoes));
    console.log("  Bia:", JSON.stringify(b.conexoes));
  }

  console.log("\nsala");
  ok(a.pessoas.some((t) => t.includes("Bia")), "Ana vê a Bia na lista");
  ok(b.pessoas.some((t) => t.includes("Ana")), "Bia vê a Ana na lista");

  console.log("\nvoz");
  ok(a.audios >= 1, "Ana tem um elemento de áudio para a Bia", `tem ${a.audios}`);
  ok(b.audios >= 1, "Bia tem um elemento de áudio para a Ana", `tem ${b.audios}`);
  ok(a.fluxos >= 1, "o fluxo remoto está ligado ao elemento", `${a.fluxos} ligados`);
  ok(a.faixas >= 1, "e traz faixa de áudio", `${a.faixas} faixas`);
  ok(
    a.recebendo >= 1 && b.recebendo >= 1,
    "a mídia está passando nos dois sentidos",
    `Ana ${a.recebendo}, Bia ${b.recebendo}`,
  );
  ok(a.tocando >= 1 && b.tocando >= 1, "e o áudio está tocando, não pausado");

  console.log("\nqualidade");
  ok(a.contextos === 1, "um AudioContext só na página", `foram ${a.contextos}`);
  ok(
    a.opus.includes("maxaveragebitrate=96000"),
    "o Opus foi negociado em 96 kbps",
    a.opus || "sem fmtp",
  );
  ok(a.opus.includes("usedtx=0"), "sem corte de transmissão no silêncio (DTX off)");
  ok(a.opus.includes("useinbandfec=1"), "com recuperação de perda embutida (FEC)");
  ok(
    a.envioAudio?.taxa === 96000,
    "o limite de envio do áudio foi aplicado",
    JSON.stringify(a.envioAudio),
  );
  ok(
    a.envioAudio?.prio === "high",
    "a voz tem prioridade de rede sobre o vídeo",
    JSON.stringify(a.envioAudio),
  );
  ok(
    a.microfone?.sampleRate === 48000,
    "o microfone está em 48 kHz",
    JSON.stringify(a.microfone),
  );

  console.log("\nsupressão de ruído");
  // Trocar o nível troca a faixa de áudio que sai daqui, no meio da chamada.
  // É `replaceTrack`, então não deveria renegociar nada nem interromper o
  // som — e "não deveria" é exatamente o tipo de frase que merece um teste.
  await abas[0].aba.js(`(() => {
    [...document.querySelectorAll("button")].find(b => /Qualidade/.test(b.textContent))?.click();
    return true;
  })()`);
  await esperar(400);
  const trocou = await abas[0].aba.js(`(() => {
    const b = [...document.querySelectorAll(".nv-opcao")].find(x => x.textContent.trim() === "Forte");
    if (!b) return false;
    b.click();
    return true;
  })()`);
  ok(trocou, "o painel oferece a supressão forte");
  await esperar(2500);

  let depois = null;
  for (let i = 0; i < 10; i += 1) {
    depois = await abas[1].aba.js(sonda);
    if (depois?.recebendo >= 1) break;
    await esperar(1000);
  }
  ok(
    depois?.recebendo >= 1,
    "com a supressão forte, a voz continua chegando do outro lado",
    `recebendo ${depois?.recebendo}`,
  );
  ok(
    depois?.audios >= 1 && depois?.faixas >= 1,
    "e a faixa continua ligada ao elemento de áudio",
    `audios ${depois?.audios}, faixas ${depois?.faixas}`,
  );

  // ── a entrada pelo formulário, em modo de desenvolvimento ──────────
  //
  // Este bloco existe por causa de um defeito que só aparecia aqui: quem
  // entrava numa sala **se via duas vezes**. A causa é uma corrida — o
  // microfone é pedido antes de conectar, e a montagem dupla que o React faz
  // em desenvolvimento desmontava a página no meio do pedido; a saída
  // acontecia com o WebSocket ainda por abrir, e a conexão subia depois, sem
  // ninguém para fechá-la. Ela ficava na sala como uma segunda pessoa com o
  // mesmo nome.
  //
  // Duas condições precisam estar juntas para o defeito acontecer, e é por
  // isso que ele escapou dos outros testes: **modo de desenvolvimento**
  // (em produção o React monta uma vez só) e a **navegação do formulário**
  // (`router.push`, e não uma carga de página inteira). Daí o segundo
  // servidor e o caminho pela interface, em vez do `localStorage` + navegação
  // direta que o resto deste arquivo usa.
  console.log("\nentrar pelo formulário (modo de desenvolvimento)");
  const devServidor = spawn("node", ["server.mjs"], {
    // pasta de build própria: o modo de desenvolvimento apagaria o build de
    // produção que o servidor deste mesmo teste está servindo
    env: {
      ...process.env,
      PORT: String(PORTA_DEV),
      NODE_ENV: "development",
      NEXT_DIST_DIR: ".next-dev",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let devSaida = "";
  devServidor.stdout.on("data", (d) => (devSaida += d));
  devServidor.stderr.on("data", (d) => (devSaida += d));
  const devPrazo = Date.now() + 60_000;
  while (!devSaida.includes("NVDISC em") && Date.now() < devPrazo) await esperar(300);

  try {
    const RAIZ_DEV = `http://localhost:${PORTA_DEV}${BASE}`;
    const salaForm = "form-" + Math.random().toString(36).slice(2, 7);
    const { alvo: alvoForm, aba: abaForm } = await novaAba(`${RAIZ_DEV}/`);
    abas.push({ nome: "Cau", alvo: alvoForm, aba: abaForm });
    await abaForm.chamar("Runtime.enable");
    await esperarPagina(abaForm, RAIZ_DEV);
    // o dev compila a rota na primeira visita
    for (let i = 0; i < 60; i += 1) {
      const temForm = await abaForm.js("!!document.querySelector('#nome')").catch(() => false);
      if (temForm) break;
      await esperar(1000);
    }

    // Digita e confere: enquanto a página não hidratou, o valor entra no
    // campo mas não no estado do React, e o botão continua desabilitado. Sem
    // esta insistência o teste clica num botão morto e falha por um motivo
    // que não é o que ele investiga.
    let liberado = false;
    for (let i = 0; i < 40 && !liberado; i += 1) {
      liberado = await abaForm
        .js(`(() => {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, "value").set;
          const digitar = (el, v) => {
            setter.call(el, v);
            el.dispatchEvent(new Event("input", { bubbles: true }));
          };
          const nome = document.querySelector("#nome");
          const sala = document.querySelector("#sala");
          if (!nome || !sala) return false;
          digitar(nome, "Cau");
          digitar(sala, ${JSON.stringify(salaForm)});
          const botao = document.querySelector("button[type=submit]");
          return !!botao && !botao.disabled;
        })()`)
        .catch(() => false);
      if (!liberado) await esperar(1000);
    }
    ok(liberado, "o formulário da entrada aceita nome e código");
    await abaForm.js(`document.querySelector("button[type=submit]").click(), true`);

    let cartoes = 0;
    for (let i = 0; i < 60; i += 1) {
      await esperar(1000);
      cartoes = await abaForm
        .js(`document.querySelectorAll(".nv-pessoa").length`)
        .catch(() => 0);
      if (cartoes > 0) break;
    }
    await esperar(2500);
    const naTela = JSON.parse(
      await abaForm.js(
        `JSON.stringify([...document.querySelectorAll(".nv-nome")].map((n) => n.textContent))`,
      ),
    );
    const onde = await abaForm.js("location.pathname").catch(() => "?");
    const comMeuNome = naTela.filter((t) => t.includes("Cau")).length;
    ok(
      comMeuNome === 1,
      "quem entra pelo formulário se vê UMA vez",
      `apareceu ${comMeuNome}x em ${onde}: ${naTela.join(", ")}`,
    );
    ok(naTela.length === 1, "e não há mais ninguém na sala nova", naTela.join(", "));
  } finally {
    devServidor.kill("SIGTERM");
    await Promise.race([once(devServidor, "exit"), esperar(3000)]);
  }

  console.log("\nchat pela interface");
  // A caixa do chat pode demorar a existir se a página tiver acabado de
  // reconectar; esperar por ela dá uma falha legível em vez de um
  // "Illegal invocation" vindo de um `querySelector` que voltou nulo.
  let temCaixa = false;
  for (let i = 0; i < 15 && !temCaixa; i += 1) {
    temCaixa = await abas[0].aba
      .js(`!!document.querySelector("aside input")`)
      .catch(() => false);
    if (!temCaixa) await esperar(1000);
  }
  ok(temCaixa, "a caixa do chat está na tela", await abas[0].aba.js("location.pathname").catch(() => "?"));
  if (temCaixa) {
  await abas[0].aba.js(`(() => {
    const campo = document.querySelector("aside input");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value").set;
    setter.call(campo, "oi da Ana");
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    campo.closest("form").requestSubmit();
  })()`);
  await esperar(800);
  const viu = await abas[1].aba.js(
    `document.querySelector("aside").textContent.includes("oi da Ana")`,
  );
  ok(viu, "a mensagem digitada por uma aparece na outra");
  }
} finally {
  for (const { aba, alvo } of abas) {
    aba.fechar();
    await fecharAba(alvo.id);
  }
  servidor.kill("SIGTERM");
  await Promise.race([once(servidor, "exit"), esperar(3000)]);
}

console.log(
  `\n${falhou === 0 ? "\x1b[38;2;79;209;160m" : "\x1b[38;2;242;101;122m"}` +
    `${passou} passaram, ${falhou} falharam\x1b[0m\n`,
);
process.exit(falhou === 0 ? 0 : 1);
