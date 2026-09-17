/** Regression tests for recovery races, using the real Malha class with fake browser peers. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const sourceUrl = new URL("../src/lib/malha.ts", import.meta.url);
let source = await readFile(sourceUrl, "utf8");
for (const name of ["protocolo.mjs", "base.mjs"])
  source = source.replace(
    `"./${name}"`,
    JSON.stringify(new URL(name, sourceUrl).href),
  );
// Signaling transport is irrelevant to these deterministic recovery scenarios.
source = source.replace(
  '"./sinal-supabase"',
  JSON.stringify(
    "data:text/javascript,export const configuracaoDoNavegador=()=>null;export const criarSinalSupabase=()=>null;",
  ),
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const { Malha } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log(`✓ ${name}`);
}
function engine() {
  const m = new Malha(() => {});
  m.meuFluxo = { getAudioTracks: () => [] };
  return m;
}
await test("disconnected persistente escala para reconstrução, sem reiniciar o relógio", async () => {
  const m = engine();
  let rebuilt = 0;
  const p = {
    pc: { connectionState: "disconnected", restartIce() {} },
    caiuEm: Date.now() - 25000,
    insistiEm: 0,
    refeita: 0,
  };
  m.pares.set("remote", p);
  m.refazerPar = async () => {
    rebuilt++;
  };
  await m.conferirFluxos();
  assert.equal(rebuilt, 1);
});
await test("queda breve preserva a chamada", async () => {
  const m = engine();
  let changed = 0;
  m.pares.set("remote", {
    pc: {
      connectionState: "disconnected",
      restartIce() {
        changed++;
      },
    },
    caiuEm: Date.now() - 1000,
    insistiEm: 0,
  });
  m.refazerPar = async () => {
    changed++;
  };
  await m.conferirFluxos();
  assert.equal(changed, 0);
});
await test("estatística atrasada não reconstrói um par que já foi substituído", async () => {
  const m = engine();
  let resolve;
  let rebuilt = 0;
  const old = {
    pc: { connectionState: "connected" },
    pacotes: 20,
    parouEm: Date.now() - 20000,
    reiniciei: true,
    refeita: 0,
  };
  m.pares.set("remote", old);
  m.pacotesDeAudio = () => new Promise((r) => (resolve = r));
  m.refazerPar = async () => {
    rebuilt++;
  };
  const running = m.conferirFluxos();
  m.pares.set("remote", {});
  resolve(20);
  await running;
  assert.equal(rebuilt, 0);
});
await test("mídia recuperada libera novas tentativas para quedas futuras", async () => {
  const m = engine();
  const p = {
    pc: { connectionState: "connected" },
    pacotes: 20,
    parouEm: 1,
    reiniciei: true,
    refeita: 2,
  };
  m.pares.set("remote", p);
  m.pacotesDeAudio = async () => 40;
  await m.conferirFluxos();
  assert.equal(p.refeita, 0);
  assert.equal(p.parouEm, 0);
});
await test("oferta pendente não é sobrescrita por uma nova oferta", async () => {
  const m = engine();
  let offers = 0;
  const p = {
    pc: {
      signalingState: "have-local-offer",
      createOffer() {
        offers++;
      },
    },
  };
  m.pares.set("remote", p);
  await m.oferecer(p, "remote");
  assert.equal(offers, 0);
});
await test("sinal atrasado de um par antigo não toca na conexão nova", async () => {
  const m = engine();
  let applied = 0;
  const p = {
    pc: {
      setRemoteDescription() {
        applied++;
      },
    },
  };
  m.pares.set("remote", {});
  await m.aplicarSinal(p, "remote", { descricao: { type: "offer", sdp: "" } });
  assert.equal(applied, 0);
});
await test("mudanças rápidas de processamento são serializadas", async () => {
  const m = engine();
  let active = 0;
  let peak = 0;
  m.montarNovaCadeia = async () => {
    active++;
    peak = Math.max(active, peak);
    await new Promise((r) => setTimeout(r, 5));
    active--;
  };
  await Promise.all([m.refazerCadeia(), m.refazerCadeia(), m.refazerCadeia()]);
  assert.equal(peak, 1);
});
await test("uma falha no processamento não bloqueia a próxima troca", async () => {
  const m = engine();
  let calls = 0;
  m.montarNovaCadeia = async () => {
    if (++calls === 1) throw Error("simulated");
  };
  await assert.rejects(m.refazerCadeia());
  await m.refazerCadeia();
  assert.equal(calls, 2);
});
await test("fim da faixa antiga de vídeo preserva a faixa nova", async () => {
  const originalPC = globalThis.RTCPeerConnection;
  const originalStream = globalThis.MediaStream;
  globalThis.RTCPeerConnection = class {
    close() {}
  };
  globalThis.MediaStream = class {
    constructor(tracks) {
      this.tracks = tracks;
    }
    getTracks() {
      return this.tracks;
    }
  };
  try {
    const m = engine();
    m.estado.participantes = [{ id: "remote", nome: "Bia" }];
    const p = await m.abrirPar("remote", false);
    const old = { id: "old", kind: "video", readyState: "live" };
    const fresh = { id: "new", kind: "video", readyState: "live" };
    p.pc.ontrack({ track: old });
    p.pc.ontrack({ track: fresh });
    old.readyState = "ended";
    old.onended();
    assert.deepEqual(m.estado.participantes[0].video.getTracks(), [fresh]);
    m.pares.set("remote", {});
    fresh.onended();
    assert.deepEqual(m.estado.participantes[0].video.getTracks(), [fresh]);
  } finally {
    globalThis.RTCPeerConnection = originalPC;
    globalThis.MediaStream = originalStream;
  }
});
console.log(`${passed} regressões passaram.`);
