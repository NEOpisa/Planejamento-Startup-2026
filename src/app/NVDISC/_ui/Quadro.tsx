"use client";

/**
 * O quadro — uma tela compartilhada como as outras.
 *
 * Ele não mora mais na gaveta das ferramentas. Desenhar num painel de 340 px
 * ao lado do chat é desenhar num guardanapo: cabia o rabisco e não cabia a
 * ideia, e o que a pessoa fazia era rabiscar, olhar, e desistir de explicar
 * pelo quadro. Agora ele é uma **aba do palco**, ao lado das telas que as
 * pessoas compartilham, e ocupa o mesmo espaço que elas.
 *
 * A divisão que sobrou é a que os programas de desenho fazem há trinta anos:
 * a tela no meio, as ferramentas na lateral. Cor, espessura, desfazer e
 * limpar ficam no painel da esquerda (`BarraQuadro`); aqui fica só a tela.
 *
 * Coordenadas continuam de 0 a 1, nunca em pixels — agora com mais razão
 * ainda, porque o palco tem tamanhos muito diferentes conforme as gavetas
 * estão abertas ou fechadas, e o mesmo traço precisa cair no mesmo lugar nas
 * duas telas.
 */

import { useEffect, useRef } from "react";

import type { EstadoFerramentas, Ferramentas as Motor, Traco } from "@/lib/ferramentas";
import {
  BorrachaIcon,
  CadeadoIcon,
  DesfazerIcon,
  ElipseIcon,
  FecharIcon,
  LimparIcon,
  MaoLivreIcon,
  QuadroIcon,
  RetaIcon,
  RetanguloIcon,
  SetaIcon,
} from "@/components/icons";

/**
 * O que a mão faz, e não só com que cor.
 *
 * A mão livre resolve o rabisco e não resolve o resto: explicar uma caixa, uma
 * ligação entre duas coisas, um "isto aqui" — as três coisas que mais se
 * desenham numa conversa — sai torto à mão em tela sensível, e sai torto
 * também no trackpad. As formas são a mesma linha de sempre, só que com os
 * pontos calculados em vez de coletados: nada muda no protocolo, e um cliente
 * antigo desenha um retângulo sem saber que é um retângulo.
 *
 * A borracha é a sexta, e é de outra natureza — não desenha, apaga. Fica aqui
 * porque no dedo de quem usa ela é só mais um bico de caneta.
 */
export type Forma = "livre" | "reta" | "retangulo" | "elipse" | "seta" | "borracha";

/** O pincel de quem desenha — escolhido no painel, usado no palco. */
export type Pincel = { cor: string; grossura: number; forma: Forma };

export const CORES = ["#6495ed", "#3ef08a", "#f4b74a", "#fb7185", "#eef1f7", "#a855f7"];
export const PINCEL_PADRAO: Pincel = { cor: CORES[0], grossura: 3, forma: "livre" };

/**
 * Os pontos de uma forma, do canto onde a mão desceu até onde ela está.
 *
 * Tudo vira **polilinha**, que é o único desenho que o protocolo conhece. O
 * retângulo fecha voltando ao começo; a elipse é amostrada em 48 lados (o
 * bastante para o olho não ver o polígono numa tela de 4K); a seta vai até a
 * ponta, desce numa barba, volta à ponta e desce na outra — voltar sobre a
 * própria linha não custa nada e evita precisar de três traços separados,
 * que seriam três desfazeres para apagar uma seta só.
 *
 * `y` é corrigido pela proporção da tela nas barbas da seta: sem isso, uma
 * seta desenhada num palco largo chega com as barbas achatadas, porque as
 * coordenadas são de 0 a 1 nos dois eixos e a tela não é quadrada.
 */
export function pontosDaForma(
  forma: Forma,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  proporcao: number,
): number[] {
  if (forma === "reta") return [x0, y0, x1, y1];

  if (forma === "retangulo") {
    return [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
  }

  if (forma === "elipse") {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = Math.abs(x1 - x0) / 2;
    const ry = Math.abs(y1 - y0) / 2;
    const p: number[] = [];
    const lados = 48;
    for (let i = 0; i <= lados; i++) {
      const a = (i / lados) * Math.PI * 2;
      p.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
    }
    return p;
  }

  if (forma === "seta") {
    // O comprimento da barba é proporcional ao da seta, com teto: numa seta
    // que atravessa a tela, uma barba proporcional viraria um triângulo.
    const dx = (x1 - x0) * proporcao;
    const dy = y1 - y0;
    const comp = Math.hypot(dx, dy);
    if (comp < 1e-4) return [x0, y0, x1, y1];
    const barba = Math.min(comp * 0.3, 0.06);
    const ang = Math.atan2(dy, dx);
    const b = (giro: number): [number, number] => [
      x1 - (barba * Math.cos(ang + giro)) / proporcao,
      y1 - barba * Math.sin(ang + giro),
    ];
    const [ax, ay] = b(Math.PI / 7);
    const [bx, by] = b(-Math.PI / 7);
    return [x0, y0, x1, y1, ax, ay, x1, y1, bx, by];
  }

  return [x0, y0, x1, y1];
}

/**
 * Um traço, em coordenadas de 0 a 1 esticadas para o tamanho do canvas.
 *
 * Exportado porque a miniatura da aba desenha o mesmo conteúdo num cofre de
 * 100 px. Duas rotinas de desenho seriam duas chances de a prévia mostrar
 * algo diferente do que está no palco.
 */
export function desenharTraco(
  ctx: CanvasRenderingContext2D,
  t: Traco,
  larg: number,
  alt: number,
) {
  const p = t.pontos;
  if (p.length < 2) return;
  ctx.strokeStyle = t.cor;
  // A espessura acompanha a largura: um traço de 3 px num palco largo aparece
  // como fio de cabelo numa miniatura, e os dois são a mesma linha para quem
  // desenhou.
  ctx.lineWidth = Math.max(0.6, (t.grossura * larg) / 900);
  ctx.beginPath();
  ctx.moveTo(p[0] * larg, p[1] * alt);
  // Um ponto só é um ponto: sem isto, tocar e soltar não deixa marca.
  if (p.length === 2) ctx.lineTo(p[0] * larg + 0.1, p[1] * alt);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * larg, p[i + 1] * alt);
  ctx.stroke();
}

/**
 * Um `<canvas>` que se redesenha e acompanha o tamanho da caixa.
 *
 * A parte chata está aqui, num lugar só: o canvas tem dois tamanhos — o da
 * tela (CSS) e o do buffer (pixels) —, e sem acertar o segundo pela densidade
 * do monitor o traço sai borrado. "Borrado" num quadro de desenho parece
 * defeito do desenho, não da tela.
 */
function useTela(
  tracos: Traco[],
  tela: React.RefObject<HTMLCanvasElement | null>,
  caixa: React.RefObject<HTMLElement | null>,
  /**
   * A forma que está sendo arrastada agora, se houver.
   *
   * Ela é desenhada **por cima e de fora do estado**: uma forma só existe de
   * verdade quando o dedo levanta, e até lá ninguém mais na sala precisa ver
   * os quarenta retângulos intermediários do arrasto. Numa `ref`, e não num
   * `useState`, porque ela muda a cada movimento do ponteiro — pelo estado,
   * cada pixel de arrasto redesenharia a sala inteira.
   */
  previa?: React.RefObject<Traco | null>,
) {
  const pintar = useRef(() => {});
  pintar.current = () => {
    const c = tela.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const t of tracos) desenharTraco(ctx, t, c.width, c.height);
    if (previa?.current) desenharTraco(ctx, previa.current, c.width, c.height);
  };

  useEffect(() => {
    const c = tela.current;
    const cx = caixa.current;
    if (!c || !cx) return;
    const medir = () => {
      const r = cx.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      c.style.width = `${r.width}px`;
      c.style.height = `${r.height}px`;
      pintar.current();
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(cx);
    return () => ro.disconnect();
  }, [tela, caixa]);

  useEffect(() => {
    pintar.current();
  });

  return () => pintar.current();
}

// ──────────────────────────────────────────────────────────── no palco ──

export function QuadroPalco({
  f,
  motor,
  eu,
  pincel,
  onFechar,
}: {
  f: EstadoFerramentas;
  motor: Motor | null;
  /** quem eu sou — a borracha só alcança traço meu */
  eu: string | null;
  pincel: Pincel;
  onFechar: () => void;
}) {
  const tela = useRef<HTMLCanvasElement | null>(null);
  const moldura = useRef<HTMLElement | null>(null);
  const desenhando = useRef(false);
  /** onde a forma começou, enquanto o dedo não levanta */
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const previa = useRef<Traco | null>(null);
  const pintar = useTela(f.quadro.tracos, tela, moldura, previa);
  const posso = f.posso.quadro;
  const dono = f.donos.quadro;
  const forma = pincel.forma;

  /** Do ponteiro para o quadro: sempre de 0 a 1, nunca em pixels. */
  function onde(e: React.PointerEvent) {
    const r = (e.target as HTMLElement).getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      /** largura sobre altura — a correção que a seta precisa */
      prop: r.height > 0 ? r.width / r.height : 1,
    };
  }

  /**
   * A borracha: apaga os traços **meus** que passam perto do ponteiro.
   *
   * A conta é em pixels, e não nas coordenadas de 0 a 1, porque o quadro não
   * é quadrado: um raio de 0,03 em `x` e em `y` seria uma elipse deitada, e a
   * borracha pegaria mais coisa de lado do que de cima — o tipo de imprecisão
   * que ninguém identifica e todo mundo xinga.
   */
  function apagarSob(x: number, y: number, larg: number, alt: number) {
    const raio = Math.max(10, pincel.grossura * 3);
    for (const t of f.quadro.tracos) {
      if (t.de !== eu) continue;
      for (let i = 0; i < t.pontos.length; i += 2) {
        const dx = t.pontos[i] * larg - x * larg;
        const dy = t.pontos[i + 1] * alt - y * alt;
        if (Math.hypot(dx, dy) <= raio) {
          motor?.apagarTraco(t.id);
          break;
        }
      }
    }
  }

  return (
    <figure className="nv-tela nv-tela--quadro" ref={moldura}>
      <canvas
        ref={tela}
        className={`${posso ? "" : "so-ver"}${forma === "borracha" ? " borracha" : ""}`}
        onPointerDown={(e) => {
          if (!posso) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          const { x, y } = onde(e);
          desenhando.current = true;

          if (forma === "borracha") {
            const r = (e.target as HTMLElement).getBoundingClientRect();
            apagarSob(x, y, r.width, r.height);
            return;
          }
          if (forma !== "livre") {
            inicio.current = { x, y };
            return;
          }
          motor?.comecarTraco(x, y, pincel.cor, pincel.grossura);
          pintar();
        }}
        onPointerMove={(e) => {
          if (!desenhando.current) return;
          const { x, y, prop } = onde(e);

          if (forma === "borracha") {
            const r = (e.target as HTMLElement).getBoundingClientRect();
            apagarSob(x, y, r.width, r.height);
            return;
          }
          if (forma !== "livre") {
            const i = inicio.current;
            if (!i) return;
            previa.current = {
              id: "previa",
              de: eu ?? "",
              cor: pincel.cor,
              grossura: pincel.grossura,
              pontos: pontosDaForma(forma, i.x, i.y, x, y, prop),
              fim: false,
            };
            pintar();
            return;
          }
          motor?.seguirTraco(x, y);
          pintar();
        }}
        onPointerUp={(e) => {
          if (!desenhando.current) return;
          desenhando.current = false;

          if (forma === "borracha") return;
          if (forma !== "livre") {
            const i = inicio.current;
            inicio.current = null;
            const pronta = previa.current;
            previa.current = null;
            // Um toque sem arrasto não vira forma nenhuma: sem esta guarda,
            // cada clique perdido no quadro deixaria um ponto invisível de
            // dois pixels que só aparece no "desfazer".
            if (i && pronta && pronta.pontos.length >= 4) {
              const { x, y } = onde(e);
              if (Math.hypot(x - i.x, y - i.y) > 0.005) {
                motor?.tracoPronto(pronta.pontos, pincel.cor, pincel.grossura);
              }
            }
            pintar();
            return;
          }
          motor?.terminarTraco();
        }}
        onPointerCancel={() => {
          if (!desenhando.current) return;
          desenhando.current = false;
          inicio.current = null;
          previa.current = null;
          if (forma === "livre") motor?.terminarTraco();
          pintar();
        }}
      />

      {f.quadro.tracos.length === 0 && (
        <p className="nv-quadro-vazio">
          {posso
            ? "Rabisque aqui — todo mundo na sala vê enquanto você desenha."
            : `${dono?.nome ?? "Alguém"} abriu o quadro. Você vê tudo; para mexer, peça a licença nas ferramentas.`}
        </p>
      )}

      <figcaption>
        <QuadroIcon size={12} />
        Quadro
        {dono && ` · de ${dono.nome}`}
        {!posso && (
          <>
            {" · "}
            <CadeadoIcon size={11} />
            só ver
          </>
        )}
      </figcaption>

      {/* O mesmo botão redondo das telas de vídeo. Um `.nv-mini` de texto
          aqui saía cortado: a caixa dos botões do palco tem 32 px de lado,
          feita para ícone. */}
      <div className="nv-tela-botoes">
        <button onClick={onFechar} title="voltar às pessoas" aria-label="Fechar o quadro">
          <FecharIcon size={15} />
        </button>
      </div>
    </figure>
  );
}

// ─────────────────────────────────────────────────────── na aba (prévia) ──

/**
 * A prévia do quadro no cartão da aba.
 *
 * As telas das pessoas mostram vídeo ao vivo no cartão, e a razão vale igual
 * aqui: uma lista de nomes obriga a abrir para descobrir o que é. Com a
 * prévia, "o quadro" deixa de ser um rótulo e passa a ser a coisa — dá para
 * ver de relance que alguém desenhou algo novo.
 */
export function MiniaturaQuadro({ tracos }: { tracos: Traco[] }) {
  const tela = useRef<HTMLCanvasElement | null>(null);
  const caixa = useRef<HTMLDivElement | null>(null);
  useTela(tracos, tela, caixa);
  return (
    <div className="nv-mini-quadro" ref={caixa}>
      <canvas ref={tela} aria-hidden />
      {tracos.length === 0 && <span>em branco</span>}
    </div>
  );
}

// ───────────────────────────────────────────────────────── no painel ──

/**
 * Os seis bicos de caneta, na ordem em que se usa.
 *
 * Mão livre primeiro porque é o padrão e o mais usado; a borracha por último
 * porque é a única que desfaz em vez de fazer, e vizinhança de coisas
 * parecidas é o que faz clicar errado.
 */
const BICOS: {
  id: Forma;
  nome: string;
  Icone: (p: { size?: number }) => React.ReactElement;
}[] = [
  { id: "livre", nome: "Mão livre", Icone: MaoLivreIcon },
  { id: "reta", nome: "Reta", Icone: RetaIcon },
  { id: "seta", nome: "Seta", Icone: SetaIcon },
  { id: "retangulo", nome: "Retângulo", Icone: RetanguloIcon },
  { id: "elipse", nome: "Elipse", Icone: ElipseIcon },
  { id: "borracha", nome: "Borracha — apaga traço seu", Icone: BorrachaIcon },
];

/** Bico, cor, espessura e as duas ações. Vive no painel da esquerda. */
export function BarraQuadro({
  f,
  motor,
  eu,
  pincel,
  onPincel,
}: {
  f: EstadoFerramentas;
  motor: Motor | null;
  eu: string | null;
  pincel: Pincel;
  onPincel: (p: Pincel) => void;
}) {
  const meus = eu ? f.quadro.tracos.filter((t) => t.de === eu).length : 0;

  return (
    <div className="nv-quadro-barra">
      {/* As formas vêm primeiro porque são a escolha que mais muda o
          resultado: cor errada é um desenho de outra cor, forma errada é um
          rabisco no lugar da caixa que se queria. */}
      <div className="nv-formas" role="group" aria-label="Bico da caneta">
        {BICOS.map(({ id, nome, Icone }) => (
          <button
            key={id}
            className={`nv-forma${id === pincel.forma ? " on" : ""}`}
            onClick={() => onPincel({ ...pincel, forma: id })}
            title={nome}
            aria-label={nome}
            aria-pressed={id === pincel.forma}
          >
            <Icone size={16} />
          </button>
        ))}
      </div>

      <div className="nv-cores" role="group" aria-label="Cor">
        {CORES.map((c) => (
          <button
            key={c}
            className={`nv-cor${c === pincel.cor ? " on" : ""}`}
            style={{ background: c }}
            onClick={() => onPincel({ ...pincel, cor: c })}
            aria-label={`cor ${c}`}
            aria-pressed={c === pincel.cor}
          />
        ))}
      </div>

      <label className="nv-grossura">
        <span className="nv-rotulo">
          {pincel.forma === "borracha" ? "Borracha" : "Traço"}
        </span>
        <input
          type="range"
          min={1}
          max={14}
          value={pincel.grossura}
          onChange={(e) => onPincel({ ...pincel, grossura: Number(e.target.value) })}
        />
        {/* A amostra vale mais que o número: "8" não diz nada, e um círculo
            de 8 px diz tudo, inclusive comparado ao traço que já está na
            tela. */}
        <i
          className="nv-amostra"
          style={{
            width: pincel.grossura + 4,
            height: pincel.grossura + 4,
            background: pincel.cor,
          }}
        />
      </label>

      <div className="nv-quadro-acoes">
        <button className="nv-btn" onClick={() => motor?.desfazer()} disabled={meus === 0}>
          <DesfazerIcon size={15} />
          Desfazer
        </button>
        <button className="nv-btn perigo" onClick={() => motor?.limparQuadro()}>
          <LimparIcon size={15} />
          Limpar
        </button>
      </div>

      {pincel.forma === "borracha" && (
        <p className="nv-nota">
          A borracha alcança os seus {meus === 1 ? "traço" : `${meus} traços`} — o
          desenho dos outros não. Para apagar tudo, use o Limpar, que é do dono
          e apaga às claras.
        </p>
      )}
    </div>
  );
}
