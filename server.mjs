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
import { createServer as createServerTLS } from "node:https";
import { readFileSync } from "node:fs";
import next from "next";
import { WebSocketServer } from "ws";

import { criarSinalizacao } from "./src/lib/sinalizacao.mjs";
import { criarRegistroMemoria } from "./src/lib/registro-memoria.mjs";
import { BASE, CAMINHO_SINAL } from "./src/lib/base.mjs";

const dev = process.env.NODE_ENV !== "production";
const porta = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const app = next({ dev, hostname: host, port: porta });
const paginas = app.getRequestHandler();

/**
 * As salas vivem na memória deste processo.
 *
 * Aqui isso basta, e é o que torna este servidor barato: um processo só serve
 * as páginas e a sinalização, e não há banco nenhum para manter. Na Vercel o
 * mesmo protocolo roda com o registro em Redis, porque lá não existe "este
 * processo" — ver `src/app/api/sinal/route.ts`.
 */
const sinalizacao = criarSinalizacao(criarRegistroMemoria());

await app.prepare();

/**
 * TLS, quando houver certificado.
 *
 * Não é capricho: **sem HTTPS o navegador não entrega o microfone** fora do
 * `localhost`. Chamar a turma pelo IP da rede (`http://192.168.x.x:3000`)
 * funciona para ver quem está na sala e para o chat, e não funciona para a
 * voz — e o pior é que o sintoma não diz isso, os botões só não fazem nada.
 *
 * `npm run cert` gera um certificado para esta máquina; os dois caminhos
 * entram por variável de ambiente para que o servidor continue rodando sem
 * TLS onde já existe um proxy fazendo isso na frente (que é o caso de
 * qualquer hospedagem séria).
 */
const certificado = process.env.TLS_CERT;
const chave = process.env.TLS_KEY;
const comTLS = Boolean(certificado && chave);

const http = comTLS
  ? createServerTLS(
      { cert: readFileSync(certificado), key: readFileSync(chave) },
      (req, res) => paginas(req, res),
    )
  : createServer((req, res) => paginas(req, res));
/**
 * Quem atende o `upgrade` — e por que isso precisa de cuidado.
 *
 * O Next instala **o próprio** tratador de `upgrade` no servidor HTTP na
 * primeira requisição que atende (ele usa isso para o recarregamento em
 * desenvolvimento). A partir daí, todo pedido de WebSocket passa pelos dois:
 * o nosso aceita a conexão da sala, o dele não reconhece o caminho e destrói
 * o socket em seguida. O sintoma é dos bons: a sala funciona enquanto ninguém
 * abriu uma página, e para de funcionar depois da primeira — a conexão abre e
 * cai na mesma hora, com o código 1006 e nenhuma mensagem em lugar nenhum.
 *
 * Então o despacho é nosso: guardamos o que o Next quiser registrar e
 * decidimos, por caminho, quem atende. `/NVDISC/sinal` é da sala; o resto
 * segue para ele.
 */
const upgradesDoNext = [];
const registrar = http.on.bind(http);
for (const metodo of ["on", "addListener", "prependListener"]) {
  http[metodo] = (evento, ouvinte) => {
    if (evento === "upgrade") {
      upgradesDoNext.push(ouvinte);
      return http;
    }
    return registrar(evento, ouvinte);
  };
}

// O caminho do WebSocket carrega o mesmo prefixo das páginas. Se ele ficasse
// em `/sinal` fixo enquanto o site vive em `/NVDISC`, o proxy da frente
// entregaria a página e engoliria a conexão — e o sintoma seria "entrei na
// sala e não vejo ninguém", sem nada no log do navegador que explique.
const wss = new WebSocketServer({ noServer: true });

registrar("upgrade", (req, socket, head) => {
  const caminho = (req.url ?? "").split("?")[0];
  if (caminho === CAMINHO_SINAL) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    return;
  }
  for (const ouvinte of upgradesDoNext) ouvinte(req, socket, head);
  if (upgradesDoNext.length === 0) socket.destroy();
});

wss.on("connection", (ws) => {
  const sessao = sinalizacao.aoConectar(ws);
  const estado = { vivo: true };
  ws.on("message", (bruto) => void sessao.aoReceber(bruto));
  ws.on("pong", () => (estado.vivo = true));
  ws.on("close", () => void sessao.aoFechar());
  // Uma conexão que morre sem avisar (notebook fechado, Wi-Fi caiu) deixaria
  // um fantasma na lista de participantes para sempre. O erro é tratado como
  // fechamento normal.
  ws.on("error", () => void sessao.aoFechar());
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
  const esquema = comTLS ? "https" : "http";
  console.log(`NVDISC em ${esquema}://${onde}:${porta}${BASE || "/"}`);
  console.log(
    `sinalização em ${comTLS ? "wss" : "ws"}://${onde}:${porta}${CAMINHO_SINAL}`,
  );
  if (!comTLS) {
    console.log(
      "\naviso: sem TLS. Do próprio computador funciona tudo; de outro\n" +
        "aparelho (http://IP-da-rede) dá para ver a sala e usar o chat, mas o\n" +
        "navegador não entrega o microfone. Rode `npm run cert` e suba com\n" +
        "TLS_CERT/TLS_KEY para falar entre dois aparelhos.",
    );
  }
  if (!process.env.NVDISC_TURN_URL) {
    console.log(
      "\naviso: sem TURN configurado. Na mesma rede e na maioria das casas\n" +
        "funciona só com STUN, mas em redes de empresa ou atrás de NAT\n" +
        "simétrico a chamada não fecha. Veja NVDISC_TURN_URL no README.",
    );
  }
});
