/**
 * Onde o NVDISC vive dentro desta central.
 *
 * Ele é a única coisa que mora neste Next, e mesmo assim continua atrás de um
 * prefixo em vez de na raiz. Não é herança esquecida: o caminho da
 * sinalização (`/NVDISC/sinal`) depende dele, a raiz redireciona para cá, e
 * mudar isso para poupar sete caracteres na URL custaria três arquivos.
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
