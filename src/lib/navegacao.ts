/**
 * Os destinos da central — um lugar só, lido pelo trilho, pela barra mobile e
 * pelo rodapé. Três listas de rotas seriam três chances de uma ferramenta
 * nova entrar num menu e faltar nos outros dois.
 *
 * `tone` é a lasca de cor à esquerda da linha no trilho, do sistema do
 * NVGHUB; `externo` marca o que não é rota do Next (a calculadora é um
 * arquivo estático servido de `public/`).
 */
export const NAV = [
  { n: "01", label: "Início", href: "/", tone: "a" },
  { n: "02", label: "Calculadora", href: "/calculadora.html", tone: "b", externo: true },
  { n: "03", label: "Plano de captação", href: "/plano", tone: "c" },
  { n: "04", label: "NVDISC · sala", href: "/NVDISC", tone: "d" },
] as const;

/** O que o trilho direito mostra sobre a operação. */
export const FATOS: [string, string][] = [
  ["Uso", "interno"],
  ["Custo", "R$ 0/mês"],
  ["Dados", "nada gravado"],
  ["Onde", "100% remoto"],
];
