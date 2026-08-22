/**
 * Onde o NVDISC vive dentro desta central.
 *
 * Aqui ele **não** é um app separado atrás de um prefixo: é uma rota deste
 * mesmo Next, ao lado da calculadora e do plano. Por isso não há `basePath` na
 * configuração — `basePath` moveria a central inteira, e a home que escolhe
 * entre as ferramentas deixaria de responder em `/`.
 *
 * O que este arquivo guarda é só o **começo da rota**, e ele existe por um
 * motivo específico: o WebSocket da sinalização precisa morar debaixo do mesmo
 * caminho (`/NVDISC/sinal`), e esse caminho é lido em três lugares — o servidor
 * que o abre, o cliente que se conecta e o teste que confere. Três cópias de um
 * endereço são três chances de divergir, e a divergência aqui não dá erro: a
 * página carrega bonita e ninguém entra na sala.
 */

/** A raiz da ferramenta dentro da central. */
export const BASE = "/NVDISC";

/** O caminho do WebSocket de sinalização. */
export const CAMINHO_SINAL = `${BASE}/sinal`;

/** Um caminho da ferramenta, a partir da raiz dela. */
export function comBase(caminho) {
  const c = String(caminho ?? "/");
  return `${BASE}${c === "/" ? "" : c.startsWith("/") ? c : `/${c}`}`;
}
