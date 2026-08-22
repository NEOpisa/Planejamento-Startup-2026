/**
 * Servidor da central.
 *
 * Um processo só: o Next serve **tudo** — a home que escolhe entre as
 * ferramentas, o plano, a calculadora e o NVDISC — e, no mesmo servidor HTTP,
 * um WebSocket em `/NVDISC/sinal` faz a sinalização do WebRTC.
 *
 * Por que a central passou a ter servidor próprio
 * ----------------------------------------------
 * Ela vivia com `next start`, que basta para páginas. O NVDISC precisa de uma
 * conexão **que fica de pé** para apresentar as pessoas de uma sala umas às
 * outras, e isso `next start` não oferece. O custo é uma linha no
 * `package.json`; o ganho é o NVDISC ser uma rota da central como qualquer
 * outra, e não um segundo serviço para subir e um segundo endereço para
 * lembrar.
 *
 * Por que servidor próprio, e não o `next start`
 * ---------------------------------------------
 * Sinalização precisa de conexão **que fica de pé**. Função serverless não
 * serve: ela nasce e morre a cada requisição, e não existe onde guardar quem
 * está em qual sala. Daí o servidor próprio — que também é o motivo de isto
 * rodar em qualquer máquina com Node e não numa hospedagem de borda.
 *
 * O que passa por aqui, e o que não passa
 * --------------------------------------
 * Passa: quem entrou, quem saiu, a negociação do WebRTC e o chat de texto.
 * Não passa: **áudio e vídeo**. A mídia vai direto de um navegador ao outro,
 * em malha. Por isso este servidor gasta quase nada mesmo com todo mundo
 * falando ao mesmo tempo, e por isso o número de pessoas por sala tem um teto
 * (ver `LIMITES.POR_SALA` no protocolo).
 *
 * O que ele não tenta ser
 * ----------------------
 * Não há conta, senha nem banco de dados. Quem tem o código da sala entra, e
 * a sala deixa de existir quando o último participante sai. Isso é a
 * funcionalidade — "só colocar um nome e entrar" —, não uma etapa que faltou.
 * Nada é gravado: o chat vive na memória de quem está na sala e some junto.
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import next from "next";
import { WebSocketServer } from "ws";

import {
  PARA_CLIENTE,
  PARA_SERVIDOR,
  LIMITES,
  limparNome,
  limparSala,
  limparSessao,
} from "./src/lib/protocolo.mjs";
import { BASE, CAMINHO_SINAL } from "./src/lib/base.mjs";

const dev = process.env.NODE_ENV !== "production";
const porta = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const app = next({ dev, hostname: host, port: porta });
const paginas = app.getRequestHandler();

/**
 * As salas, na memória.
 *
 * `Map<codigoDaSala, Map<idDoParticipante, Participante>>`. Não há
 * persistência de propósito: uma sala é uma conversa, e conversa que acabou
 * não precisa continuar existindo em disco.
 */
const salas = new Map();

/** @typedef {{id:string, nome:string, mudo:boolean, tela:boolean, ws:import("ws").WebSocket, sala:string, sessao:string, chatEm:number[]}} Participante */

function envia(ws, tipo, corpo = {}) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ tipo, ...corpo }));
}

/** Manda para todos da sala, menos (opcionalmente) um. */
function difunde(sala, tipo, corpo, exceto = null) {
  const gente = salas.get(sala);
  if (!gente) return;
  for (const p of gente.values()) {
    if (p.id === exceto) continue;
    envia(p.ws, tipo, corpo);
  }
}

function publico(p) {
  return { id: p.id, nome: p.nome, mudo: p.mudo, tela: p.tela };
}

function sair(p) {
  if (!p?.sala) return;
  const gente = salas.get(p.sala);
  if (!gente) return;
  gente.delete(p.id);
  if (gente.size === 0) {
    // Sala vazia é sala que não existe. Guardar o registro dela seria guardar
    // uma lista crescente de nomes de sala para sempre, sem servir a ninguém.
    salas.delete(p.sala);
  } else {
    difunde(p.sala, PARA_CLIENTE.SAIU, { id: p.id });
  }
}

/**
 * Tira da sala a conexão anterior **da mesma aba**.
 *
 * Uma aba que volta — reconexão depois de queda de rede, recarga da página,
 * ou o remonte que o React faz em desenvolvimento — chega como uma conexão
 * nova, com identificador novo. Do lado do servidor não há como distinguir
 * isso de uma segunda pessoa, e a anterior fica na sala até a varredura de
 * trinta segundos derrubá-la. Nesse meio tempo todo mundo vê a pessoa duas
 * vezes, ela inclusive — que é o "aparecem dois eu" ao entrar numa sala.
 *
 * O `sessao` que a aba manda no `ENTRAR` é o que fecha esse buraco: mesma
 * aba, a antiga sai na hora.
 */
function derrubarSessaoAnterior(gente, sala, sessao) {
  if (!sessao) return;
  for (const outro of [...gente.values()]) {
    if (outro.sessao !== sessao) continue;
    gente.delete(outro.id);
    difunde(sala, PARA_CLIENTE.SAIU, { id: outro.id });
    // Zera a sala antes de fechar: o `close` chama `sair`, e sem isto ele
    // anunciaria a mesma saída de novo — e apagaria uma sala que acabou de
    // receber gente.
    outro.sala = "";
    try {
      outro.ws.close();
    } catch {
      /* já fechada */
    }
  }
}

function entrar(ws, dados) {
  const sala = limparSala(dados.sala);
  const nome = limparNome(dados.nome) || "anônimo";
  const sessao = limparSessao(dados.sessao);

  if (!sala) {
    envia(ws, PARA_CLIENTE.ERRO, { motivo: "código de sala inválido" });
    return null;
  }

  if (!salas.has(sala)) salas.set(sala, new Map());
  const gente = salas.get(sala);

  // Antes de contar o limite: a aba que volta não pode ocupar duas vagas.
  derrubarSessaoAnterior(gente, sala, sessao);

  if (gente.size >= LIMITES.POR_SALA) {
    envia(ws, PARA_CLIENTE.ERRO, {
      motivo:
        `esta sala já está com ${LIMITES.POR_SALA} pessoas, que é o limite. ` +
        `A conversa é direta entre os navegadores, e acima disso a conexão de ` +
        `quem tem internet mais fraca começa a sofrer.`,
    });
    return null;
  }

  /** @type {Participante} */
  const p = {
    id: randomUUID(),
    nome,
    mudo: false,
    tela: false,
    ws,
    sala,
    sessao,
    chatEm: [],
  };

  // A lista vai **antes** de anunciar a chegada: assim quem entra já sabe com
  // quem falar, e quem estava lá recebe um `ENTROU` de alguém que a lista do
  // recém-chegado já contempla. Na ordem inversa, dois entrando ao mesmo
  // tempo podem não se ver.
  envia(ws, PARA_CLIENTE.BEMVINDO, {
    voceId: p.id,
    sala,
    participantes: [...gente.values()].map(publico),
  });
  gente.set(p.id, p);
  difunde(sala, PARA_CLIENTE.ENTROU, publico(p), p.id);
  return p;
}

/** Rajada de chat: janela deslizante de 10 s por conexão. */
function podeFalar(p) {
  const agora = Date.now();
  p.chatEm = p.chatEm.filter((t) => agora - t < 10_000);
  if (p.chatEm.length >= LIMITES.CHAT_RAJADA) return false;
  p.chatEm.push(agora);
  return true;
}

function aoReceber(estado, bruto) {
  let msg;
  try {
    msg = JSON.parse(bruto);
  } catch {
    return; // lixo entra, lixo é ignorado — não vale derrubar a conexão
  }
  if (!msg || typeof msg.tipo !== "string") return;

  // Antes de entrar, a única mensagem aceita é a de entrar.
  if (!estado.p) {
    if (msg.tipo === PARA_SERVIDOR.ENTRAR) estado.p = entrar(estado.ws, msg);
    return;
  }
  const p = estado.p;

  switch (msg.tipo) {
    case PARA_SERVIDOR.PING:
      envia(p.ws, PARA_CLIENTE.PONG);
      break;

    case PARA_SERVIDOR.SINAL: {
      // O servidor não lê o conteúdo do sinal — ele é assunto entre os dois
      // navegadores. O que ele garante é a **origem**: `de` é preenchido aqui,
      // e não aceito do cliente, senão qualquer um poderia se passar por
      // qualquer um dentro da sala.
      const alvo = salas.get(p.sala)?.get(msg.para);
      if (alvo) envia(alvo.ws, PARA_CLIENTE.SINAL, { de: p.id, dados: msg.dados });
      break;
    }

    case PARA_SERVIDOR.CHAT: {
      const texto = String(msg.texto ?? "").slice(0, LIMITES.CHAT).trim();
      if (!texto || !podeFalar(p)) break;
      difunde(p.sala, PARA_CLIENTE.CHAT, {
        de: p.id,
        nome: p.nome,
        texto,
        em: Date.now(),
      });
      break;
    }

    case PARA_SERVIDOR.ESTADO: {
      if (typeof msg.mudo === "boolean") p.mudo = msg.mudo;
      if (typeof msg.tela === "boolean") p.tela = msg.tela;
      difunde(p.sala, PARA_CLIENTE.ESTADO, {
        id: p.id,
        mudo: p.mudo,
        tela: p.tela,
      });
      break;
    }
  }
}

await app.prepare();

const http = createServer((req, res) => paginas(req, res));
// O caminho do WebSocket carrega o mesmo prefixo das páginas. Se ele ficasse
// em `/sinal` fixo enquanto o site vive em `/NVDISC`, o proxy da frente
// entregaria a página e engoliria a conexão — e o sintoma seria "entrei na
// sala e não vejo ninguém", sem nada no log do navegador que explique.
const wss = new WebSocketServer({ server: http, path: CAMINHO_SINAL });

wss.on("connection", (ws) => {
  const estado = { ws, p: null, vivo: true };
  ws.on("message", (bruto) => aoReceber(estado, bruto));
  ws.on("pong", () => (estado.vivo = true));
  ws.on("close", () => sair(estado.p));
  // Uma conexão que morre sem avisar (notebook fechado, Wi-Fi caiu) deixaria
  // um fantasma na lista de participantes para sempre. O erro é tratado como
  // fechamento normal.
  ws.on("error", () => sair(estado.p));
  estado.ws = ws;
  ws._estado = estado;
});

/**
 * Varredura de conexões mortas.
 *
 * TCP não avisa quando o outro lado some sem fechar: sem isto, uma pessoa que
 * fecha o notebook fica na lista da sala indefinidamente, e os outros ficam
 * tentando falar com um fantasma. Trinta segundos é curto o bastante para não
 * incomodar e longo o bastante para não brigar com uma rede instável.
 */
const batida = setInterval(() => {
  for (const ws of wss.clients) {
    const estado = ws._estado;
    if (!estado) continue;
    if (!estado.vivo) {
      ws.terminate();
      continue;
    }
    estado.vivo = false;
    try {
      ws.ping();
    } catch {
      /* a próxima volta encerra */
    }
  }
}, 30_000);
wss.on("close", () => clearInterval(batida));

http.listen(porta, host, () => {
  const onde = host === "0.0.0.0" ? "localhost" : host;
  console.log(`NVDISC em http://${onde}:${porta}${BASE || "/"}`);
  console.log(`sinalização em ws://${onde}:${porta}${CAMINHO_SINAL}`);
  if (!process.env.NVDISC_TURN_URL) {
    console.log(
      "\naviso: sem TURN configurado. Na mesma rede e na maioria das casas\n" +
        "funciona só com STUN, mas em redes de empresa ou atrás de NAT\n" +
        "simétrico a chamada não fecha. Veja NVDISC_TURN_URL no README.",
    );
  }
});
