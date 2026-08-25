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
} from "@/lib/ferramentas";
import { BarraQuadro, type Pincel } from "./Quadro";
import {
  CadeadoIcon,
  EnqueteIcon,
  FecharIcon,
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
  pincel,
  onPincel,
  quadroNoPalco,
  onAbrirQuadroNoPalco,
  onAbrir,
  onFechar,
}: {
  motor: Motor | null;
  f: EstadoFerramentas;
  /** qual ferramenta está na tela; `null` é o menu */
  aberta: IdFerramenta | null;
  eu: string | null;
  pincel: Pincel;
  onPincel: (p: Pincel) => void;
  quadroNoPalco: boolean;
  onAbrirQuadroNoPalco: () => void;
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
          {aberta === "quadro" && (
            <Quadro
              f={f}
              motor={motor}
              eu={eu}
              pincel={pincel}
              onPincel={onPincel}
              noPalco={quadroNoPalco}
              onAbrirPalco={onAbrirQuadroNoPalco}
            />
          )}
          {aberta === "notas" && <Notas f={f} motor={motor} />}
          {aberta === "mao" && <Fila f={f} motor={motor} eu={eu} />}
          {aberta === "enquete" && <Enquete f={f} motor={motor} eu={eu} />}
          {aberta === "tempo" && <Tempo f={f} motor={motor} />}

          {/* As outras ferramentas continuam à mão, embaixo.
              Sem isto, trocar de ferramenta é sempre dois cliques — voltar ao
              menu e escolher —, e a metade de baixo do painel fica vazia
              justamente porque a tela do quadro saiu daqui. */}
          <Atalhos f={f} atual={aberta} onAbrir={onAbrir} />
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

/**
 * As outras ferramentas, em linha compacta.
 *
 * É o mesmo menu, sem a descrição e sem o ícone grande: quem já está dentro
 * de uma ferramenta não precisa que lhe expliquem as outras de novo — precisa
 * chegar nelas.
 */
function Atalhos({
  f,
  atual,
  onAbrir,
}: {
  f: EstadoFerramentas;
  atual: IdFerramenta;
  onAbrir: (id: IdFerramenta) => void;
}) {
  const outras = CATALOGO.filter((c) => c.id !== atual);
  return (
    <nav className="nv-ferr-atalhos" aria-label="Outras ferramentas">
      <span className="nv-rotulo">Outras</span>
      {outras.map((c) => {
        const Icone = ICONE[c.id];
        const dono = f.donos[c.id];
        return (
          <button key={c.id} className="nv-ferr-atalho" onClick={() => onAbrir(c.id)}>
            <Icone size={15} />
            {c.titulo}
            {dono && <i className="nv-ponto" title={`aberta por ${dono.nome}`} />}
          </button>
        );
      })}
    </nav>
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

/**
 * O quadro, aqui, é só o painel de controle.
 *
 * A tela dele mora no palco, numa aba ao lado das telas compartilhadas
 * (`Quadro.tsx`) — desenhar numa gaveta de 340 px ao lado do chat era
 * desenhar num guardanapo. O que sobra deste lado é o que os programas de
 * desenho põem na lateral há trinta anos: cor, espessura e as duas ações.
 */
function Quadro({
  f,
  motor,
  eu,
  pincel,
  onPincel,
  noPalco,
  onAbrirPalco,
}: {
  f: EstadoFerramentas;
  motor: Motor | null;
  eu: string | null;
  pincel: Pincel;
  onPincel: (p: Pincel) => void;
  /** o quadro já está ocupando o palco? */
  noPalco: boolean;
  onAbrirPalco: () => void;
}) {
  return (
    <div className="nv-quadro">
      {!noPalco && (
        // Sem isto, quem abre "Quadro" no menu vê cor e espessura sem tela
        // nenhuma à vista, e não tem como adivinhar que a tela está numa aba
        // do palco atrás do painel.
        <button className="nv-btn principal nv-quadro-ir" onClick={onAbrirPalco}>
          <QuadroIcon size={15} />
          Abrir o quadro no palco
        </button>
      )}

      {f.posso.quadro ? (
        <BarraQuadro f={f} motor={motor} eu={eu} pincel={pincel} onPincel={onPincel} />
      ) : (
        <p className="nv-nota">
          Você vê o quadro ao vivo no palco. Cor e espessura aparecem aqui
          quando a licença chegar.
        </p>
      )}
    </div>
  );
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
