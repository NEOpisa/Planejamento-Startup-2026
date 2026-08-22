import { once } from "node:events";
import fs from "node:fs";
import { WebSocket } from "ws";
const CDP = 9343, BASE = "https://www.neovanguard.sbs";
const SALA = "med-" + Math.random().toString(36).slice(2, 6);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const sonda = fs.readFileSync("scripts/sonda.js", "utf8");

async function abrir(url) {
  const r = await fetch(`http://localhost:${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const alvo = await r.json();
  const ws = new WebSocket(alvo.webSocketDebuggerUrl, { maxPayload: 64*1024*1024 });
  await once(ws, "open");
  let n = 0; const pend = new Map(); const logs = [];
  ws.on("message", (b) => { const m = JSON.parse(b);
    if (m.id && pend.has(m.id)) { const {resolve,reject}=pend.get(m.id); pend.delete(m.id); m.error?reject(new Error(m.error.message)):resolve(m.result); return; }
    if (m.method === "Runtime.consoleAPICalled" && ["error","warning"].includes(m.params.type))
      logs.push(m.params.type + ": " + m.params.args.map(a=>a.value??a.description??"").join(" ").slice(0,160));
    if (m.method === "Runtime.exceptionThrown") logs.push("exceção: " + (m.params.exceptionDetails?.exception?.description??"").split("\n")[0]);
  });
  const chamar=(mt,p={})=>{const id=++n;ws.send(JSON.stringify({id,method:mt,params:p}));return new Promise((res,rej)=>{pend.set(id,{resolve:res,reject:rej});setTimeout(()=>pend.delete(id)&&rej(new Error(mt)),40000);});};
  const js=async e=>(await chamar("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true})).result?.value;
  await chamar("Runtime.enable");
  await chamar("Page.enable");
  // ganchos de diagnóstico, antes de qualquer script da página
  await chamar("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const Orig = window.RTCPeerConnection;
    window.__pcs = [];
    window.RTCPeerConnection = function (...a) { const pc = new Orig(...a); window.__pcs.push(pc); return pc; };
    window.RTCPeerConnection.prototype = Orig.prototype;
    const AC = window.AudioContext; window.__acs = 0;
    window.AudioContext = function (...b) { window.__acs += 1; return new AC(...b); };
    window.AudioContext.prototype = AC.prototype;
  })()` });
  return { alvo, js, logs, fechar:()=>ws.close() };
}

const abas = [];
for (const nome of ["Ana", "Bia"]) {
  const a = await abrir(`${BASE}/NVDISC/`);
  await esperar(3500);
  await a.js(`localStorage.setItem('nvdisc:nome','${nome}')`);
  await a.js(`location.href='${BASE}/NVDISC/sala/${SALA}'`);
  abas.push({ nome, a });
  await esperar(6000);
}
await esperar(8000);

for (const { nome, a } of abas) {
  const quem = await a.js(`JSON.stringify([...document.querySelectorAll('.nv-nome')].map(n=>n.textContent))`).catch(()=>"?");
  console.log(`\n${nome}: ${quem}`);
  const s = await a.js(sonda).catch(e=>({erro:String(e)}));
  const detalhe = await a.js(`JSON.stringify((window.__pcs??[]).map(p=>({con:p.connectionState,ice:p.iceConnectionState,sig:p.signalingState,tx:p.getSenders?.().length,rx:p.getReceivers?.().length})))`).catch(()=>"?");
  console.log("  RTCPeerConnections:", detalhe);
  console.log("  elementos de áudio:", s?.audios, "| fluxos ligados:", s?.fluxos);
  console.log("  faixas:", s?.faixas, "| recebendo:", s?.recebendo, "| tocando:", s?.tocando, "| AudioContexts:", s?.contextos);
  if (a.logs.length) console.log("  console:", a.logs.slice(0,4).join(" || "));
}
for (const { a } of abas) { a.fechar(); await fetch(`http://localhost:${CDP}/json/close/${a.alvo.id}`).catch(()=>{}); }
process.exit(0);
