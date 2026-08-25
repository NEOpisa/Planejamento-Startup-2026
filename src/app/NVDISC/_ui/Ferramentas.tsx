"use client";

/**
 * O menu de ferramentas da sala.
 *
 * Ele mora ao lado do chat, na mesma gaveta da direita, e por um motivo que
 * vale escrever: uma ferramenta que rouba o palco tira o vídeo de quem está
 * falando. Quem abre o quadro quer desenhar **enquanto** conversa — se para a
 * conversa para desenhar, era mais fácil mandar uma foto no chat.
 *
 * A regra da permissão está em `lib/ferramentas.ts`, com o porquê. Aqui é só
 * a cara dela: quem não pode mexer vê o cadeado e um botão de pedir; quem é
 * dono vê os pedidos chegando e responde num clique.
 */

import { useEffect, useRef, useState } from "react";

import {
  CATALOGO,
  type EstadoFerramentas,
  type Ferramentas as Motor,
  type IdFerramenta,
  type Traco,
} from "@/lib/ferramentas";
import {
  CadeadoIcon,
  DesfazerIcon,
  EnqueteIcon,
  FecharIcon,
  LimparIcon,
  MaoIcon,
  NotasIcon,
  QuadroIcon,
  TempoIcon,
} from "@/components/icons";

const ICONE: Record<IdFerramenta, (p: { size?: number }) => React.ReactElement> = {
  quadro: QuadroIcon,
  notas: NotasIcon,
  mao: MaoIcon,
  enquete: EnqueteIcon,
  tempo: TempoIcon,
};

export default function PainelFerramentas({
  motor,
  f,
  aberta,
  eu,
  onAbrir,
  onFechar,
}: {
  motor: Motor | null;
  f: EstadoFerramentas;
  /** qual ferramenta está na tela; `null` é o menu */
  aberta: IdFerramenta | null;
  eu: string | null;
  onAbrir: (id: IdFerramenta | null) => void;
  onFechar: () => void;
}) {
  const item = CATALOGO.find((c) => c.id === aberta);

  return (
    <aside className="nv-ferr aberto" aria-label="Ferramentas da sala">
      <header className="nv-ferr-topo">
        {aberta ? (
          <button className="nv-ferr-voltar" onClick={() => onAbrir(null)}>
            ← Ferramentas
          </button>
        ) : (
          <strong>Ferramentas</strong>
        )}
        <button className="nv-ferr-x" onClick={onFechar} aria-label="Fechar ferramentas">
          <FecharIcon />
        </button>
      </header>

      {/* Os pedidos aparecem em qualquer tela do painel, e não só na
          ferramenta pedida: quem está desenhando não vai ao menu conferir se
          alguém pediu licença, e um pedido que espera calado é um "não" que
          ninguém quis dar. */}
      <Pedidos f={f} motor={motor} />

      {!aberta && <Menu f={f} onAbrir={onAbrir} />}

      {aberta && item && (
        <div className="nv-ferr-corpo">
          <Cabecalho f={f} id={aberta} motor={motor} eu={eu} />
          {aberta === "quadro" && <Quadro f={f} motor={motor} eu={eu} />}
          {aberta === "notas" && <Notas f={f} motor={motor} />}
          {aberta === "mao" && <Fila f={f} motor={motor} eu={eu} />}
          {aberta === "enquete" && <Enquete f={f} motor={motor} eu={eu} />}
          {aberta === "tempo" && <Tempo f={f} motor={motor} />}
        </div>
      )}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────── o menu ──

function Menu({
  f,
  onAbrir,
}: {
  f: EstadoFerramentas;
  onAbrir: (id: IdFerramenta) => void;
}) {
  return (
    <div className="nv-ferr-menu">
      {CATALOGO.map((c) => {
        const Icone = ICONE[c.id];
        const dono = f.donos[c.id];
        const ativa =
          (c.id === "quadro" && f.quadro.tracos.length > 0) ||
          (c.id === "notas" && f.notas.texto.length > 0) ||
          (c.id === "mao" && f.maos.length > 0) ||
          (c.id === "enquete" && Boolean(f.enquete)) ||
          (c.id === "tempo" && (f.tempo.rodando || f.tempo.restante > 0));

        return (
          <button key={c.id} className="nv-ferr-item" onClick={() => onAbrir(c.id)}>
            <span className="nv-ferr-icone">
              <Icone size={19} />
            </span>
            <span className="nv-ferr-texto">
              <b>
                {c.titulo}
                {ativa && <i className="nv-ponto" aria-label="em uso" />}
              </b>
              <span>{c.para}</span>
              {dono && (
                <em className="nv-ferr-dono">
                  aberta por {dono.nome}
                  {!f.posso[c.id] && " · você só vê"}
                </em>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** O cabeçalho de uma ferramenta: quem é dono, e o que dá para fazer. */
function Cabecalho({
  f,
  id,
  motor,
  eu,
}: {
  f: EstadoFerramentas;
  id: IdFerramenta;
  motor: Motor | null;
  eu: string | null;
}) {
  const c = CATALOGO.find((x) => x.id === id)!;
  const dono = f.donos[id];
  const posso = f.posso[id];
  // Comparar com quem eu sou é a única forma que não erra. A versão anterior
  // encadeava `dono && posso && …`, e "tem dono e eu posso mexer" também é
  // verdade para quem recebeu licença — que veria "— você" no nome do outro.
  const souDono = Boolean(dono && eu && dono.id === eu);

  if (!c.dono) {
    return (
      <div className="nv-ferr-cab">
        <h3>{c.titulo}</h3>
        <p>{c.para}</p>
      </div>
    );
  }

  return (
    <div className="nv-ferr-cab">
      <h3>{c.titulo}</h3>
      {!dono && (
        <>
          <p>
            Sem dono — está livre, e qualquer um da sala mexe. Pegar faz de
            você o dono: os outros continuam vendo tudo, e passam a pedir
            licença para mexer.
          </p>
          <button className="nv-btn principal" onClick={() => motor?.abrir(id)}>
            Pegar {c.titulo.toLowerCase()}
          </button>
        </>
      )}
      {dono && posso && (
        <>
          <p className="nv-ferr-linha">
            <i className="nv-ponto" /> Aberta por <b>{dono.nome}</b>
            {souDono && " — você"}
          </p>
          <button className="nv-btn" onClick={() => motor?.fechar(id)}>
            Fechar e liberar
          </button>
        </>
      )}
      {dono && !posso && (
        <>
          <p className="nv-ferr-linha">
            <CadeadoIcon size={15} /> <b>{dono.nome}</b> abriu isto. Você vê tudo
            ao vivo; para mexer, é preciso a licença dela.
          </p>
          <button
            className="nv-btn principal"
            disabled={Boolean(f.pedindo[id])}
            onClick={() => motor?.pedir(id)}
          >
            {f.pedindo[id] ? "Pedido enviado — esperando…" : "Pedir para mexer"}
          </button>
        </>
      )}
    </div>
  );
}

/** Os pedidos de licença que estão esperando a minha resposta. */
function Pedidos({ f, motor }: { f: EstadoFerramentas; motor: Motor | null }) {
  if (f.pedidos.length === 0) return null;
  return (
    <div className="nv-pedidos">
      {f.pedidos.map((p) => (
        <div key={`${p.f}-${p.de}`} className="nv-pedido">
          <p>
            <b>{p.nome}</b> quer mexer{" "}
            {p.f === "quadro" ? "no quadro" : "nas notas"}.
          </p>
          <div className="nv-pedido-acoes">
            <button
              className="nv-btn principal"
              onClick={() => motor?.responder(p.f, p.de, true)}
            >
              Deixar
            </button>
            <button className="nv-btn" onClick={() => motor?.responder(p.f, p.de, false)}>
              Agora não
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────── o quadro ──

const CORES = ["#6495ed", "#3ef08a", "#f4b74a", "#fb7185", "#eef1f7", "#a855f7"];

/**
 * O quadro.
 *
 * O desenho é pintado num `<canvas>`, e **não** redesenhado pelo React a cada
 * ponto: um traço chega dezenas de vezes por segundo, e repintar a árvore
 * inteira nesse ritmo trava a chamada junto. O React manda no que está em
 * volta — cores, espessura, botões —, e o canvas se vira sozinho.
 *
 * Quem não tem licença ainda vê tudo: o `<canvas>` é o mesmo, só não escuta o
 * ponteiro. Ver de graça e mexer com licença é a regra inteira.
 */
function Quadro({
  f,
  motor,
  eu,
}: {
  f: EstadoFerramentas;
  motor: Motor | null;
  eu: string | null;
}) {
  const tela = useRef<HTMLCanvasElement | null>(null);
  const caixa = useRef<HTMLDivElement | null>(null);
  const [cor, setCor] = useState(CORES[0]);
  const [grossura, setGrossura] = useState(3);
  const desenhando = useRef(false);
  const posso = f.posso.quadro;

  /** Repinta tudo. Chamado quando os traços mudam e quando a caixa muda de tamanho. */
  function pintar() {
    const c = tela.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const t of f.quadro.tracos) desenharTraco(ctx, t, c.width, c.height);
  }

  // O canvas tem dois tamanhos: o da tela (CSS) e o do buffer (pixels). Sem
  // acertar o segundo pela densidade do monitor, o traço sai borrado em tela
  // retina — e "borrado" num quadro de desenho parece defeito do desenho.
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
      pintar();
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(cx);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(pintar);

  /** Do ponteiro para o quadro: sempre de 0 a 1, nunca em pixels. */
  function onde(e: React.PointerEvent) {
    const r = (e.target as HTMLElement).getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  const meus = eu ? f.quadro.tracos.filter((t) => t.de === eu).length : 0;

  return (
    <div className="nv-quadro">
      <div className="nv-quadro-tela" ref={caixa}>
        <canvas
          ref={tela}
          className={posso ? "" : "so-ver"}
          onPointerDown={(e) => {
            if (!posso) return;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            const { x, y } = onde(e);
            motor?.comecarTraco(x, y, cor, grossura);
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
            {posso ? "Rabisque aqui." : "Nada desenhado ainda."}
          </p>
        )}
      </div>

      {posso && (
        <div className="nv-quadro-barra">
          <div className="nv-cores" role="group" aria-label="Cor">
            {CORES.map((c) => (
              <button
                key={c}
                className={`nv-cor${c === cor ? " on" : ""}`}
                style={{ background: c }}
                onClick={() => setCor(c)}
                aria-label={`cor ${c}`}
                aria-pressed={c === cor}
              />
            ))}
          </div>

          <label className="nv-grossura">
            <span className="nv-rotulo">Traço</span>
            <input
              type="range"
              min={1}
              max={14}
              value={grossura}
              onChange={(e) => setGrossura(Number(e.target.value))}
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
      )}
    </div>
  );
}

/** Um traço, em coordenadas de 0 a 1 esticadas para o tamanho do canvas. */
function desenharTraco(
  ctx: CanvasRenderingContext2D,
  t: Traco,
  larg: number,
  alt: number,
) {
  const p = t.pontos;
  if (p.length < 2) return;
  ctx.strokeStyle = t.cor;
  // A espessura acompanha a largura do quadro: um traço de 3 px desenhado num
  // painel largo aparece como fio de cabelo num painel estreito, e os dois
  // são a mesma linha para quem desenhou.
  ctx.lineWidth = Math.max(1, (t.grossura * larg) / 900);
  ctx.beginPath();
  ctx.moveTo(p[0] * larg, p[1] * alt);
  if (p.length === 2) {
    // Um ponto só é um ponto: sem isto, tocar e soltar não deixa marca.
    ctx.lineTo(p[0] * larg + 0.1, p[1] * alt);
  }
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * larg, p[i + 1] * alt);
  ctx.stroke();
}

// ─────────────────────────────────────────────────────────────── as notas ──

function Notas({ f, motor }: { f: EstadoFerramentas; motor: Motor | null }) {
  const posso = f.posso.notas;
  const [rascunho, setRascunho] = useState(f.notas.texto);
  const meu = useRef(false);

  // O que chega da sala só sobrescreve o campo quando não sou eu quem está
  // digitando: sem esta guarda, a mensagem que eu mesmo mandei voltaria e
  // saltaria o cursor para o fim a cada tecla.
  useEffect(() => {
    if (!meu.current) setRascunho(f.notas.texto);
  }, [f.notas.texto]);

  return (
    <div className="nv-notas">
      <textarea
        value={rascunho}
        readOnly={!posso}
        maxLength={4000}
        placeholder={posso ? "A ata da conversa…" : "Ninguém escreveu nada ainda."}
        onChange={(e) => {
          meu.current = true;
          setRascunho(e.target.value);
          motor?.escreverNotas(e.target.value);
          // Solto a guarda um pouco depois da última tecla: o eco da rede
          // chega com atraso, e soltar na hora traria o salto de volta.
          setTimeout(() => (meu.current = false), 900);
        }}
      />
      <p className="nv-nota">
        {f.notas.em > 0
          ? `Última alteração de ${f.notas.porNome}. O texto vive enquanto a sala existir.`
          : "O texto vive enquanto a sala existir — e some junto com ela."}
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── a fila ──

function Fila({
  f,
  motor,
  eu,
}: {
  f: EstadoFerramentas;
  motor: Motor | null;
  eu: string | null;
}) {
  const minha = f.maos.some((m) => m.id === eu);

  return (
    <div className="nv-fila">
      <button
        className={`nv-btn ${minha ? "ligado" : "principal"}`}
        onClick={() => motor?.mao(!minha)}
      >
        <MaoIcon size={16} />
        {minha ? "Abaixar a mão" : "Levantar a mão"}
      </button>

      {f.maos.length === 0 ? (
        <p className="nv-nota">
          Ninguém na fila. Quem levantar a mão aparece aqui na ordem em que
          levantou — e a ordem é a mesma na tela de todo mundo.
        </p>
      ) : (
        <ol className="nv-fila-lista">
          {f.maos.map((m, i) => (
            <li key={m.id} className={m.id === eu ? "eu" : ""}>
              <span className="nv-fila-n">{i + 1}</span>
              {m.nome}
              {m.id === eu && <em>você</em>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────── a enquete ──

function Enquete({
  f,
  motor,
  eu,
}: {
  f: EstadoFerramentas;
  motor: Motor | null;
  eu: string | null;
}) {
  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState(["", ""]);
  const q = f.enquete;
  const souDono = f.donos.enquete?.id === eu;

  if (!q) {
    return (
      <div className="nv-enquete">
        <div className="nv-campo">
          <label className="nv-rotulo" htmlFor="q-pergunta">
            A pergunta
          </label>
          <input
            id="q-pergunta"
            value={pergunta}
            maxLength={120}
            placeholder="Sexta ou sábado?"
            onChange={(e) => setPergunta(e.target.value)}
          />
        </div>

        {opcoes.map((o, i) => (
          <div className="nv-campo" key={i}>
            <label className="nv-rotulo" htmlFor={`q-op-${i}`}>
              Opção {i + 1}
            </label>
            <input
              id={`q-op-${i}`}
              value={o}
              maxLength={60}
              placeholder={["sexta", "sábado", "outra data", "tanto faz", "…", "…"][i]}
              onChange={(e) =>
                setOpcoes((v) => v.map((x, j) => (j === i ? e.target.value : x)))
              }
            />
          </div>
        ))}

        <div className="nv-enquete-acoes">
          {opcoes.length < 6 && (
            <button className="nv-btn" onClick={() => setOpcoes((v) => [...v, ""])}>
              + opção
            </button>
          )}
          <button
            className="nv-btn principal"
            disabled={!pergunta.trim() || opcoes.filter((o) => o.trim()).length < 2}
            onClick={() => {
              motor?.abrirEnquete(pergunta, opcoes);
              setPergunta("");
              setOpcoes(["", ""]);
            }}
          >
            Perguntar à sala
          </button>
        </div>
      </div>
    );
  }

  const total = Object.keys(q.votos).length;

  return (
    <div className="nv-enquete">
      <p className="nv-enquete-p">{q.pergunta}</p>

      <div className="nv-enquete-ops">
        {q.opcoes.map((o, i) => {
          const votos = Object.values(q.votos).filter((v) => v === i).length;
          const pct = total > 0 ? Math.round((votos / total) * 100) : 0;
          return (
            <button
              key={i}
              className={`nv-voto${q.meuVoto === i ? " meu" : ""}`}
              disabled={!q.aberta}
              onClick={() => motor?.votar(i)}
              // A barra é o próprio fundo do botão: uma barra separada
              // embaixo do rótulo dobraria a altura da lista e faria seis
              // opções não caberem na gaveta.
              style={{ ["--pct" as string]: `${pct}%` }}
            >
              <span>{o}</span>
              <b>
                {votos} · {pct}%
              </b>
            </button>
          );
        })}
      </div>

      <p className="nv-nota">
        {total === 0
          ? "Ninguém votou ainda."
          : `${total} ${total === 1 ? "voto" : "votos"}. Dá para mudar de ideia até fechar.`}
        {!q.aberta && " Encerrada."}
      </p>

      {souDono && q.aberta && (
        <button className="nv-btn" onClick={() => motor?.encerrarEnquete()}>
          Encerrar votação
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────── o temporizador ──

const ATALHOS = [60, 300, 600, 900];

function Tempo({ f, motor }: { f: EstadoFerramentas; motor: Motor | null }) {
  const [, repintar] = useState(0);
  const t = f.tempo;

  // Um tique por segundo enquanto anda. O estado não guarda "quanto falta" —
  // guarda **quando acaba** —, então quem conta o tempo é este relógio, e
  // parado ele não custa nada.
  useEffect(() => {
    if (!t.rodando) return;
    const i = setInterval(() => repintar((n) => n + 1), 250);
    return () => clearInterval(i);
  }, [t.rodando]);

  const resta = t.rodando && t.fimEm
    ? Math.max(0, Math.round((t.fimEm - Date.now()) / 1000))
    : t.restante;
  const mm = String(Math.floor(resta / 60)).padStart(2, "0");
  const ss = String(resta % 60).padStart(2, "0");
  const acabou = t.rodando && resta === 0;

  return (
    <div className="nv-tempo">
      <p className={`nv-relogio${acabou ? " acabou" : ""}`}>
        {mm}:{ss}
      </p>

      {acabou && <p className="nv-nota">Acabou o tempo.</p>}

      <div className="nv-tempo-atalhos">
        {ATALHOS.map((s) => (
          <button key={s} className="nv-btn" onClick={() => motor?.iniciarTempo(s)}>
            {s < 60 ? `${s}s` : `${s / 60} min`}
          </button>
        ))}
      </div>

      <div className="nv-tempo-acoes">
        {t.rodando ? (
          <button className="nv-btn" onClick={() => motor?.pausarTempo()}>
            Pausar
          </button>
        ) : (
          <button
            className="nv-btn principal"
            disabled={t.restante === 0}
            onClick={() => motor?.iniciarTempo(t.restante)}
          >
            Continuar
          </button>
        )}
        <button className="nv-btn" onClick={() => motor?.zerarTempo()}>
          Zerar
        </button>
      </div>

      <p className="nv-nota">
        O mesmo relógio para todos: o que viaja é quanto falta, não a hora de
        acabar — dois computadores raramente concordam sobre que horas são.
      </p>
    </div>
  );
}
