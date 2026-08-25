/**
 * Para onde se pode ir a partir daqui.
 *
 * Um lugar só, lido pelo trilho, pela barra do telefone e pela tela de
 * entrada. Três listas de destinos seriam três chances de um endereço novo
 * entrar num menu e faltar nos outros dois.
 *
 * `tone` é a lasca de cor à esquerda da linha no trilho, do sistema do
 * NVGHUB. `breve` marca o que ainda não existe — e marcar é melhor do que
 * esconder: quem abre a sala pela primeira vez quer saber o que a casa vai
 * ter, e um destino apagado não conta essa história.
 */

export type Destino = {
  n: string;
  label: string;
  /** o nome por extenso, para a tela de escolha */
  titulo: string;
  d: string;
  href: string;
  tone: "a" | "b" | "c" | "d";
  /** não é rota deste Next */
  externo?: boolean;
  /** ainda não existe */
  breve?: boolean;
  /** o rótulo da porta na tela de escolha */
  cta: string;
};

export const DESTINOS: Destino[] = [
  {
    n: "01",
    label: "Sala de voz",
    titulo: "NVDISC · sala de voz",
    d: "Voz, tela e texto na mesma sala, com quadro, notas e enquete ao lado. Sem conta e sem cadastro: um nome, um código, e quem digitar o mesmo código cai na mesma sala.",
    href: "/NVDISC",
    tone: "a",
    cta: "Entrar numa sala",
  },
  {
    n: "02",
    label: "Neovanguard",
    titulo: "NVGHUB · o estúdio",
    d: "O site da casa: o que a Neovanguard constrói, como trabalha e por onde falar com quem escreve o código.",
    href: "https://neovanguard.com.br",
    tone: "b",
    externo: true,
    cta: "Abrir o site",
  },
  {
    n: "03",
    label: "Estudos",
    titulo: "NVSTUDY · estudos",
    d: "Planner, redação com correção, questões e revisão espaçada para ENEM, vestibular e concurso — no mesmo lugar.",
    href: "#",
    tone: "c",
    breve: true,
    cta: "Em breve",
  },
  {
    n: "04",
    label: "Identidade",
    titulo: "Identidade Nostr",
    d: "Entrar na sala como você mesmo, com as doze palavras que já abrem o Neovanguard OS — sem senha e sem servidor de contas no meio.",
    href: "#",
    tone: "d",
    breve: true,
    cta: "Em breve",
  },
];

/** Só o que já existe entra no trilho: menu não é vitrine. */
export const NAV = DESTINOS.filter((d) => !d.breve);

/** O que o trilho direito mostra sobre a sala. */
export const FATOS: [string, string][] = [
  ["Voz", "direto entre navegadores"],
  ["Sala", "até 8 pessoas"],
  ["Conta", "nenhuma"],
  ["Gravação", "nada fica"],
];
