/**
 * O que cada pessoa ajusta na própria sala.
 *
 * Tudo aqui é **só de quem ajusta**. Nada é dito à sala, nada viaja pela
 * sinalização, e a tela de quem está do outro lado não muda — é a mesma
 * promessa que o volume por pessoa já fazia. Um ajuste de aparência que
 * mexesse na tela alheia seria uma forma estranha de moderação.
 *
 * Vive no `localStorage`, e não no `sessionStorage`: quem escolheu o tamanho
 * de texto que enxerga bem não quer reescolher a cada visita.
 *
 * Cada campo é conferido um a um na leitura. Um `localStorage` de outra versão
 * do app — ou editado à mão — não pode injetar um valor que o CSS não conhece,
 * porque o valor vira um `data-` no elemento raiz e um seletor que não casa
 * deixa a sala sem estilo nenhum.
 */

export type Preferencias = {
  /** a cor de acento; o resto da paleta não muda */
  tema: string;
  /**
   * O fundo da sala.
   *
   * `grade` é o da central (dois brilhos e a malha de 44 px), `brilho` tira a
   * grade e deixa só a luz, `liso` é o quase-preto puro. O liso não é
   * austeridade: numa chamada longa, com uma tela compartilhada ocupando o
   * meio, textura de fundo compete com o conteúdo o tempo todo.
   */
  fundo: "grade" | "brilho" | "liso";
  /**
   * Quanto ar entre as coisas.
   *
   * Vira um multiplicador nos espaçamentos, não um conjunto de medidas novas —
   * uma escala mexe em tudo de uma vez e não deixa dois lugares discordarem.
   */
  densidade: "compacto" | "confortavel" | "amplo";
  /** escala do texto da sala, de 0.9 a 1.15 */
  texto: number;
  /** o raio dos cantos; `reto` é 0 e existe para quem acha o resto mole demais */
  cantos: "reto" | "suave" | "redondo";
  /**
   * Movimento.
   *
   * `reduzido` desliga transições e o crescimento do anel de fala. Vale por
   * gosto e vale por necessidade: para quem tem sensibilidade vestibular, uma
   * sala que pulsa doze vezes por segundo é motivo para fechar a aba. O
   * `prefers-reduced-motion` do sistema continua valendo por cima disto.
   */
  movimento: "completo" | "reduzido";
  /**
   * Avatares coloridos.
   *
   * A cor sai do **nome**, por uma conta que todos os navegadores fazem igual
   * (ver `corDaPessoa`). Ninguém escolhe a própria cor, e é de propósito: uma
   * cor escolhida teria de viajar pela sinalização para os outros verem a
   * mesma, e uma cor derivada do nome já chega igual em todo mundo sem
   * protocolo nenhum. Quem quer trocar de cor troca de nome.
   */
  avatares: "cor" | "neutro";
  /**
   * A régua de nível ao lado do próprio microfone, sempre visível.
   *
   * Desligada por padrão porque é informação de ajuste, não de conversa. Ligada
   * responde de relance a pergunta que aparece toda vez que a sala fica quieta:
   * "eles não estão falando, ou eu que não estou sendo ouvido?".
   */
  medidor: boolean;
};

export const PREFERENCIAS_PADRAO: Preferencias = {
  tema: "cornflower",
  fundo: "grade",
  densidade: "confortavel",
  texto: 1,
  cantos: "suave",
  movimento: "completo",
  avatares: "cor",
  medidor: false,
};

/** As cores de acento oferecidas. O valor é o `data-tema` que o CSS conhece. */
export const TEMAS = [
  { v: "cornflower", r: "Cornflower", cor: "#6495ed" },
  { v: "ambar", r: "Âmbar", cor: "#f4b74a" },
  { v: "esmeralda", r: "Esmeralda", cor: "#3ef08a" },
  { v: "gelo", r: "Gelo", cor: "#67e8f9" },
  { v: "violeta", r: "Violeta", cor: "#a78bfa" },
  { v: "carmim", r: "Carmim", cor: "#fb7185" },
  { v: "menta", r: "Menta", cor: "#5eead4" },
  { v: "coral", r: "Coral", cor: "#fb923c" },
  { v: "lilas", r: "Lilás", cor: "#f0abfc" },
] as const;

const CHAVE = "nvdisc:preferencias";
/** De onde vinha só a cor de acento, antes de existir o resto. */
const CHAVE_ANTIGA = "nvdisc:tema";

export function lerPreferencias(): Preferencias {
  const p = { ...PREFERENCIAS_PADRAO };
  try {
    // O tema morava sozinho noutra chave. Quem já tinha escolhido uma cor não
    // pode perdê-la porque o app passou a guardar mais coisas.
    const antigo = localStorage.getItem(CHAVE_ANTIGA);
    if (antigo && TEMAS.some((t) => t.v === antigo)) p.tema = antigo;

    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return p;
    const lido = JSON.parse(bruto) as Partial<Preferencias>;

    const um = <T,>(v: unknown, opcoes: readonly T[], padrao: T) =>
      opcoes.includes(v as T) ? (v as T) : padrao;

    return {
      tema: TEMAS.some((t) => t.v === lido.tema) ? (lido.tema as string) : p.tema,
      fundo: um(lido.fundo, ["grade", "brilho", "liso"] as const, p.fundo),
      densidade: um(lido.densidade, ["compacto", "confortavel", "amplo"] as const, p.densidade),
      texto:
        typeof lido.texto === "number" && Number.isFinite(lido.texto)
          ? Math.min(1.15, Math.max(0.9, lido.texto))
          : p.texto,
      cantos: um(lido.cantos, ["reto", "suave", "redondo"] as const, p.cantos),
      movimento: um(lido.movimento, ["completo", "reduzido"] as const, p.movimento),
      avatares: um(lido.avatares, ["cor", "neutro"] as const, p.avatares),
      medidor: typeof lido.medidor === "boolean" ? lido.medidor : p.medidor,
    };
  } catch {
    // Navegação privativa com armazenamento bloqueado **lança** no acesso, em
    // vez de devolver nulo. Sem este `catch` a sala inteira deixava de abrir.
    return p;
  }
}

export function guardarPreferencias(p: Preferencias) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
    // A chave velha some junto: mantê-la faria a cor voltar sozinha para a
    // antiga na próxima leitura, porque ela é aplicada antes do resto.
    localStorage.removeItem(CHAVE_ANTIGA);
  } catch {
    /* sem onde guardar: vale por esta sessão */
  }
}

/**
 * A cor de uma pessoa, tirada do nome dela.
 *
 * Derivada, e não sorteada nem escolhida, por três motivos que se somam: chega
 * **igual em todos os navegadores** sem passar pela sinalização; é a **mesma
 * amanhã**, então a cor vira reconhecimento em vez de enfeite; e não custa um
 * campo novo no protocolo, que é onde mudanças assim costumam cobrar caro.
 *
 * O matiz é livre, a saturação e a luz não são: as duas ficam presas numa
 * faixa que se lê sobre o fundo escuro da sala. Matiz livre com luz livre
 * produziria, mais cedo ou mais tarde, um avatar quase preto com a letra
 * quase preta em cima.
 */
export function corDaPessoa(nome: string): { fundo: string; anel: string } {
  let h = 0;
  for (let i = 0; i < nome.length; i += 1) {
    // O deslocamento de 5 é o do `hashCode` do Java, e serve pelo mesmo motivo:
    // espalha bem para textos curtos, que é o caso de todo nome.
    h = (h << 5) - h + nome.charCodeAt(i);
    h |= 0;
  }
  const matiz = Math.abs(h) % 360;
  return {
    fundo: `linear-gradient(150deg, hsl(${matiz} 62% 42%), hsl(${(matiz + 32) % 360} 74% 62%))`,
    anel: `hsl(${(matiz + 16) % 360} 80% 66%)`,
  };
}
