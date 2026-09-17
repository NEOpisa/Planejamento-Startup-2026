/**
 * Quantas colunas a grade de pessoas usa, e de que tamanho sai cada cartão.
 *
 * A conta antiga partia da largura da **janela** menos 580 px — o que a
 * lateral e o chat ocupariam se estivessem abertos. Com os dois fechados, que
 * é o caso comum, oito pessoas viravam oito tiras em pé numa fileira só, e
 * duas pessoas ficavam com 268 px cada num palco de 1440. A conta certa parte
 * do espaço que o palco **tem**, medido, e experimenta todas as colunas
 * possíveis: fica a que deixa o cartão maior.
 *
 * É uma função pura, em `.mjs`, para o `npm test` poder conferi-la sem
 * navegador.
 *
 * @param {object} o
 * @param {number} o.largura  largura útil do palco, em px (sem o preenchimento)
 * @param {number} o.altura   altura útil do palco, em px
 * @param {number} o.n        quantas pessoas
 * @param {number} [o.vao]    espaço entre cartões
 * @param {number} [o.proporcao] largura ÷ altura do cartão
 * @param {number} [o.piso]   abaixo disto o cartão deixa de dizer quem é; a grade rola
 * @param {number} [o.teto]   acima disto o cartão vira outdoor com uma letra dentro
 * @returns {{ colunas: number, lado: number, rola: boolean }}
 */
export function arrumarGrade({
  largura,
  altura,
  n,
  vao = 16,
  proporcao = 16 / 10,
  piso = 120,
  teto = 440,
}) {
  const total = Math.max(1, Math.floor(n));
  if (!(largura > 0) || !(altura > 0)) return { colunas: total, lado: piso, rola: false };

  // Empate no teto é comum (duas pessoas num monitor grande cabem a 440 px em
  // uma fileira ou em duas). Aí vence quem deixa menos buraco na última
  // fileira — quatro pessoas em 3 + 1 parecem alguém sobrando —, e depois o
  // bloco com o formato mais parecido com o do palco.
  const formato = Math.log(largura / altura);
  let melhor = null;
  for (let colunas = 1; colunas <= total; colunas++) {
    const linhas = Math.ceil(total / colunas);
    const pelaLargura = (largura - vao * (colunas - 1)) / colunas;
    const pelaAltura = ((altura - vao * (linhas - 1)) / linhas) * proporcao;
    const lado = Math.min(pelaLargura, pelaAltura, teto);
    const buracos = colunas * linhas - total;
    const desvio = Math.abs(Math.log((colunas * proporcao) / linhas) - formato);
    // Uns poucos pixels a mais não pagam uma fileira de quatro em pé.
    const folga = Math.max(0.5, lado * 0.04);
    const empata = melhor && Math.abs(lado - melhor.lado) <= folga;
    if (
      !melhor ||
      lado > melhor.lado + folga ||
      (empata && buracos < melhor.buracos) ||
      (empata && buracos === melhor.buracos && desvio < melhor.desvio)
    )
      melhor = { colunas, lado, buracos, desvio };
  }

  if (melhor.lado >= piso) return { colunas: melhor.colunas, lado: Math.floor(melhor.lado), rola: false };

  // Não cabe todo mundo sem espremer: enche a largura com cartões de pelo
  // menos `piso` e deixa a grade rolar na vertical.
  const colunas = Math.max(1, Math.min(total, Math.floor((largura + vao) / (piso + vao))));
  const lado = Math.min(teto, (largura - vao * (colunas - 1)) / colunas);
  return { colunas, lado: Math.floor(Math.max(lado, Math.min(piso, largura))), rola: true };
}
