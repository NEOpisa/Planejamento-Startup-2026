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
  CadeadoIcon,
  DesfazerIcon,
  FecharIcon,
  LimparIcon,
  QuadroIcon,
} from "@/components/icons";

/** O pincel de quem desenha — escolhido no painel, usado no palco. */
export type Pincel = { cor: string; grossura: number };

export const CORES = ["#6495ed", "#3ef08a", "#f4b74a", "#fb7185", "#eef1f7", "#a855f7"];
export const PINCEL_PADRAO: Pincel = { cor: CORES[0], grossura: 3 };

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
  pincel,
  onFechar,
}: {
  f: EstadoFerramentas;
  motor: Motor | null;
  pincel: Pincel;
  onFechar: () => void;
}) {
  const tela = useRef<HTMLCanvasElement | null>(null);
  const moldura = useRef<HTMLElement | null>(null);
  const desenhando = useRef(false);
  const pintar = useTela(f.quadro.tracos, tela, moldura);
  const posso = f.posso.quadro;
  const dono = f.donos.quadro;

  /** Do ponteiro para o quadro: sempre de 0 a 1, nunca em pixels. */
  function onde(e: React.PointerEvent) {
    const r = (e.target as HTMLElement).getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  return (
    <figure className="nv-tela nv-tela--quadro" ref={moldura}>
      <canvas
        ref={tela}
        className={posso ? "" : "so-ver"}
        onPointerDown={(e) => {
          if (!posso) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          const { x, y } = onde(e);
          motor?.comecarTraco(x, y, pincel.cor, pincel.grossura);
          desenhando.current = true;
          pintar();
        }}
        onPointerMove={(e) => {
          if (!desenhando.current) return;
          const { x, y } = onde(e);
          motor?.seguirTraco(x, y);
          pintar();
        }}
        onPointerUp={() => {
          if (!desenhando.current) return;
          desenhando.current = false;
          motor?.terminarTraco();
        }}
        onPointerCancel={() => {
          if (!desenhando.current) return;
          desenhando.current = false;
          motor?.terminarTraco();
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

/** Cor, espessura e as duas ações. Vive no painel da esquerda. */
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
        <span className="nv-rotulo">Traço</span>
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
    </div>
  );
}
