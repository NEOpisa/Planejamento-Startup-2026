/**
 * As ferramentas da sala, em dois navegadores de verdade.
 *
 *     npm run test:ferramentas
 *
 * O `npm test` cobre o **transporte**: que o servidor repassa o recado sem
 * lê-lo, carimba a origem e recusa o que passa do tamanho. O que ele não
 * alcança é a regra da permissão, que vive inteira no cliente — e que só é
 * verdade quando duas pessoas estão na mesma sala ao mesmo tempo.
 *
 * Daí este: sobe o servidor, abre duas abas, e percorre o caminho que uma
 * conversa percorre. A Ana pega o quadro; a Bia vê o cadeado; a Bia pede; a
 * Ana recebe o pedido e libera; a Bia desenha e o traço chega na tela da Ana.
 *
 * Nenhum desses passos dá erro quando quebra. Um "conceder" que não chega, um
 * retrato que não sai, um traço que fica só na tela de quem desenhou — tudo
 * isso aparece como uma sala que parece funcionar e não funciona, que é a
 * classe de defeito que este projeto mais produz.
 *
 * Ele precisa de um Chrome. Se não achar nenhum, avisa e sai por cima: uma
 * máquina sem navegador não é um teste falhando.
 */

import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { WebSocket } from "ws";

import { BASE } from "../src/lib/base.mjs";

const PORTA = 3417;
const DEPURACAO = 9344;
const PERFIL = "/tmp/nvdisc-teste-ferramentas";

/**
 * Onde procurar um Chrome.
 *
 * Nativo primeiro, Flatpak depois. O Firefox não serve: o protocolo de
 * depuração que isto usa é o do Chrome.
 */
function acharNavegador() {
  for (const bin of ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"]) {
    // `spawnSync` com `shell: true` **e** lista de argumentos concatena sem
    // escapar, e o Node avisa (DEP0190). Uma linha só resolve os dois.
    if (spawnSync(`command -v ${bin}`, { shell: true, stdio: "ignore" }).status === 0) {
      return { cmd: bin, args: [] };
    }
  }
  const flat = spawnSync("flatpak", ["info", "com.google.Chrome"], { stdio: "ignore" });
  if (flat.status === 0) {
    return {
      cmd: "flatpak",
      args: ["run", "--filesystem=/tmp", "--command=chrome", "com.google.Chrome"],
    };
  }
  return null;
}

const navegador = acharNavegador();
if (!navegador) {
  console.log("\nsem Chrome nesta máquina — o teste das ferramentas não roda aqui.");
  console.log("(instale chromium, ou o Flatpak com.google.Chrome)\n");
  process.exit(0);
}

/**
 * Porta de depuração ocupada é a armadilha deste teste.
 *
 * Um Chrome de uma rodada anterior que não morreu continua respondendo em
 * `/json/list`, e o teste se conecta **nele** — numa aba de outra sala, com
 * outro estado. O resultado não é um erro: são passos falhando um sim, um
 * não, do jeito mais confuso possível. Melhor recusar de saída.
 */
try {
  const r = await fetch(`http://localhost:${DEPURACAO}/json/version`, {
    signal: AbortSignal.timeout(800),
  });
  if (r.ok) {
    console.log(
      `\nja tem um navegador na porta ${DEPURACAO} — é de uma rodada que não morreu.` +
        `\nfeche-o (pkill -f remote-debugging-port=${DEPURACAO}) e rode de novo.\n`,
    );
    process.exit(1);
  }
} catch {
  /* porta livre, que é o esperado */
}

// Perfil sempre novo: o anterior traz abas abertas e `localStorage` da
// rodada passada, e o nome guardado de lá muda quem entra na sala.
rmSync(PERFIL, { recursive: true, force: true });

console.log("\nsubindo o servidor…");
const servidor = spawn("node", ["server.mjs"], {
  env: { ...process.env, PORT: String(PORTA), NODE_ENV: "production" },
  stdio: ["ignore", "ignore", "ignore"],
});

const RAIZ = `http://localhost:${PORTA}${BASE}`;
const chrome = spawn(navegador.cmd, [
  ...navegador.args,
  "--headless=new",
  "--disable-gpu",
  `--remote-debugging-port=${DEPURACAO}`,
  `--user-data-dir=${PERFIL}`,
  "--window-size=1400,900",
  "about:blank",
], { stdio: ["ignore", "ignore", "ignore"] });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fechar o navegador de verdade — e só o nosso.
 *
 * `chrome.kill()` sozinho não basta quando ele veio do Flatpak: o que morre é
 * o `flatpak run`, e o Chrome continua de pé dentro do sandbox segurando a
 * porta de depuração. A rodada seguinte se conecta ao navegador da rodada
 * anterior, numa aba de outra sala, e os passos falham um sim, um não, sem
 * dizer por quê.
 *
 * As duas saídas óbvias não servem. `pkill -f` não enxerga o processo, que
 * está noutro espaço de PIDs; e `flatpak kill com.google.Chrome` mataria
 * junto o Chrome que a pessoa estiver usando para trabalhar — um teste não
 * fecha as abas de ninguém.
 *
 * Sobra pedir a ele que feche, pelo mesmo protocolo que o teste já usa. O
 * `Browser.close` atinge exatamente o navegador em que nos conectamos, e
 * nenhum outro.
 */
async function encerrarNavegador() {
  try {
    const v = await fetch(`http://localhost:${DEPURACAO}/json/version`, {
      signal: AbortSignal.timeout(1500),
    });
    const { webSocketDebuggerUrl } = await v.json();
    const ws = new WebSocket(webSocketDebuggerUrl);
    await new Promise((pronto) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ id: 1, method: "Browser.close" }));
        setTimeout(pronto, 700);
      });
      ws.on("error", pronto);
      setTimeout(pronto, 2500);
    });
    try {
      ws.close();
    } catch {
      /* fechou junto com o navegador */
    }
  } catch {
    /* já foi, ou nunca subiu */
  }
  try {
    chrome.kill();
  } catch {
    /* idem */
  }
}

const passos = [];
const ok = (c, d) => { passos.push(`${c ? "  ✓" : "  ✗"} ${d}`); return c; };

async function alvos() {
  const r = await fetch(`http://localhost:${DEPURACAO}/json/list`);
  return (await r.json()).filter((t) => t.type === "page");
}

async function abrir(url) {
  const r = await fetch(`http://localhost:${DEPURACAO}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl, { maxPayload: 32 * 1024 * 1024 });
  await new Promise((r) => ws.on("open", r));
  let n = 0; const pend = new Map();
  ws.on("message", (b) => { const m = JSON.parse(b); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const js = async (e) => (await cdp("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }))?.result?.value;
  return { cdp, js };
}

// O servidor e o navegador sobem em paralelo; espera-se pelos dois.
let deuPe = false;
let ultimo = "";
for (let i = 0; i < 60 && !deuPe; i += 1) {
  await espera(500);
  try {
    await alvos();
    deuPe = (await fetch(RAIZ)).status === 200;
  } catch (e) {
    ultimo = e?.message ?? String(e);
  }
}
if (!deuPe) {
  console.log(`o servidor ou o navegador não subiram a tempo (${ultimo}).`);
  await encerrarNavegador();
  servidor.kill("SIGTERM");
  process.exit(1);
}

try {
  // Cada aba com o seu nome, na mesma sala.
  const a = await abrir(`http://localhost:${PORTA}/`);
  await espera(1200);
  await a.js(`localStorage.setItem("nvdisc:nome","Ana")`);
  await a.cdp("Page.navigate", { url: `${RAIZ}/sala/mao` });
  await espera(4500);

  const b = await abrir(`http://localhost:${PORTA}/`);
  await espera(1200);
  await b.js(`localStorage.setItem("nvdisc:nome","Bia")`);
  await b.cdp("Page.navigate", { url: `${RAIZ}/sala/mao` });
  await espera(5000);

  const clicar = (p, txt) => p.js(`(() => {
    const alvo = ${JSON.stringify("X")}; void alvo;
    const t = ${JSON.stringify(txt)}.toLowerCase();
    const b = [...document.querySelectorAll("button, .nv-ferr-item")]
      .find((x) => (x.textContent || "").trim().toLowerCase().includes(t));
    if (!b) return "não achei: " + t;
    b.click(); return "ok";
  })()`);
  const texto = (p) => p.js(`(document.querySelector(".nv-ferr")?.innerText || "").replace(/\\n+/g, " | ")`);

  ok((await a.js(`document.body.innerText.includes("2 na sala")`)) === true, "as duas abas se veem na sala");

  await clicar(a, "Ferramentas"); await espera(500);
  await clicar(a, "Quadro"); await espera(600);
  await clicar(a, "Pegar quadro"); await espera(1500);
  ok((await texto(a)).includes("Fechar e liberar"), "Ana pega o quadro e vira dona");

  await clicar(b, "Ferramentas"); await espera(500);
  await clicar(b, "Quadro"); await espera(1200);
  const tb = await texto(b);
  ok(tb.includes("Ana") && tb.includes("licença"), "Bia vê que o quadro é da Ana e está trancado");
  ok(tb.includes("Pedir para mexer"), "e vê o botão de pedir");

  await clicar(b, "Pedir para mexer"); await espera(1500);
  ok((await texto(b)).includes("esperando"), "o pedido sai e Bia fica esperando");
  const ta = await texto(a);
  ok(ta.includes("Bia") && ta.includes("quer mexer"), "o pedido chega à Ana");

  await clicar(a, "Deixar"); await espera(1800);
  const tb2 = await texto(b);
  ok(!tb2.includes("Pedir para mexer"), "concedida a licença, o cadeado some para Bia");

  // E o desenho atravessa: a Bia desenha, a Ana recebe.
  await b.js(`(() => {
    const c = document.querySelector(".nv-quadro-tela canvas");
    const r = c.getBoundingClientRect();
    const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, {
      clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerId: 1,
    }));
    c.setPointerCapture = () => {};
    ev("pointerdown", 20, 20);
    for (let i = 1; i < 30; i += 1) ev("pointermove", 20 + i * 4, 20 + i * 3);
    ev("pointerup", 140, 110);
    return "desenhei";
  })()`);
  await espera(2000);
  ok((await texto(a)).includes("Rabisque aqui") === false, "o traço da Bia chega ao quadro da Ana");
} catch (erro) {
  passos.push(`  ✗ o teste estourou: ${erro?.message ?? erro}`);
} finally {
  console.log("\nferramentas — o aperto de mão da permissão");
  console.log(passos.join("\n"));
  const falhou = passos.filter((p) => p.includes("✗")).length;
  console.log(
    `\n${falhou === 0 ? "\x1b[38;2;79;209;160m" : "\x1b[38;2;242;101;122m"}` +
      `${passos.length - falhou} passaram, ${falhou} falharam\x1b[0m\n`,
  );
  await encerrarNavegador();
  servidor.kill("SIGTERM");
  process.exit(falhou === 0 ? 0 : 1);
}
