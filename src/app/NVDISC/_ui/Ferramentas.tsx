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
  BaixarIcon,
  CadeadoIcon,
  CopiarIcon,
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

/**
 * O que cada ferramenta tem dentro, em três palavras.
 *
 * O menu dizia só se a ferramenta estava "em uso", com uma bolinha. É a
 * informação menos útil possível: quem olha a lista quer saber **o quê** —
 * três pessoas na fila, uma votação aberta, dois minutos no relógio. Sem
 * isso, a única forma de descobrir se vale abrir era abrir, e o painel
 * inteiro trocava de tela para responder "nada".
 *
 * `null` é o estado vazio, e ele não vira selo nenhum: uma lista com cinco
 * selos escritos "vazio" é ruído com cara de informação.
 */
function resumoVivo(f: EstadoFerramentas, id: IdFerramenta): string | null {
  if (id === "quadro") {
    const n = f.quadro.tracos.length;
    return n > 0 ? `${n} ${n === 1 ? "traço" : "traços"}` : null;
  }
  if (id === "notas") {
    const n = f.notas.texto.trim().length;
    return n > 0 ? `${n} caracteres` : null;
  }
  if (id === "mao") {
    const n = f.maos.length;
    return n > 0 ? `${n} na fila` : null;
  }
  if (id === "enquete") {
    const q = f.enquete;
    if (!q) return null;
    const votos = Object.keys(q.votos).length;
    if (!q.aberta) return "encerrada";
    return votos > 0 ? `${votos} ${votos === 1 ? "voto" : "votos"}` : "aberta";
  }
  if (id === "tempo") {
    const t = f.tempo;
    const resta = t.rodando && t.fimEm
      ? Math.max(0, Math.round((t.fimEm - Date.now()) / 1000))
      : t.restante;
    if (!t.rodando && resta === 0) return null;
    const mm = String(Math.floor(resta / 60)).padStart(2, "0");
    const ss = String(resta % 60).padStart(2, "0");
    return `${mm}:${ss}${t.rodando ? "" : " · em pausa"}`;
  }
  return null;
}

function Menu({
  f,
  onAbrir,
}: {
  f: EstadoFerramentas;
  onAbrir: (id: IdFerramenta) => void;
}) {
  const [, repintar] = useState(0);

  // O relógio da lista anda sozinho enquanto a contagem corre. Parado, o selo
  // mostraria o tempo de quando a lista foi desenhada — que é pior do que não
  // mostrar tempo nenhum, porque parece certo.
  useEffect(() => {
    if (!f.tempo.rodando) return;
    const i = setInterval(() => repintar((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [f.tempo.rodando]);

  return (
    <div className="nv-ferr-menu">
      {CATALOGO.map((c) => {
        const Icone = ICONE[c.id];
        const dono = f.donos[c.id];
        const resumo = resumoVivo(f, c.id);

        return (
          <button key={c.id} className="nv-ferr-item" onClick={() => onAbrir(c.id)}>
            <span className="nv-ferr-icone">
              <Icone size={19} />
            </span>
            <span className="nv-ferr-texto">
              <b>{c.titulo}</b>
              <span>{c.para}</span>
              {dono && (
                <em className="nv-ferr-dono">
                  aberta por {dono.nome}
                  {!f.posso[c.id] && " · você só vê"}
                </em>
              )}
            </span>
            {resumo && <span className="nv-ferr-selo">{resumo}</span>}
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
  const [copiado, setCopiado] = useState(false);
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
      {/*
        * Tirar a ata da sala era o buraco da ferramenta.
        *
        * "O texto vive enquanto a sala existir" é honesto e é péssima notícia:
        * quem escreve a ata de uma conversa escreve **para depois**, e a
        * ferramenta não tinha nenhuma saída — nem copiar, nem salvar. A
        * pessoa selecionava com o mouse dentro de um `textarea` de 200 px, ou
        * perdia. Duas linhas de código resolvem uma perda que não tem
        * conserto.
        */}
      <div className="nv-notas-acoes">
        <button
          className="nv-btn"
          disabled={!rascunho}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(rascunho);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1800);
            } catch {
              /* sem permissão de área de transferência */
            }
          }}
        >
          <CopiarIcon size={15} />
          {copiado ? "copiado ✓" : "Copiar"}
        </button>
        <button className="nv-btn" disabled={!rascunho} onClick={() => baixarNotas(rascunho)}>
          <BaixarIcon size={15} />
          Baixar
        </button>
        <span className="nv-notas-conta">{rascunho.length}/4000</span>
      </div>

      <p className="nv-nota">
        {f.notas.em > 0
          ? `Última alteração de ${f.notas.porNome}. O texto vive enquanto a sala existir.`
          : "O texto vive enquanto a sala existir — e some junto com ela."}
      </p>
    </div>
  );
}

/**
 * Salva a ata num arquivo de texto.
 *
 * `Blob` e `URL.createObjectURL`, e não um `data:` gigante na href: um texto
 * de 4.000 caracteres com acento vira uma URL de dezenas de milhares de
 * caracteres depois de escapada, e há navegador que a corta em silêncio — o
 * arquivo baixa truncado sem nenhum erro. O `revokeObjectURL` fecha a
 * torneira: sem ele, cada salvamento prende o texto na memória da aba até
 * alguém recarregar a página.
 */
function baixarNotas(texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  const dia = new Date().toISOString().slice(0, 10);
  a.download = `nvdisc-notas-${dia}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ───────────────────────────────────────────────────────────── a fila ──

/** Há quanto tempo a mão está levantada, em palavra curta. */
function espera(desde: number): string {
  const s = Math.max(0, Math.round((Date.now() - desde) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)} min`;
}

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
  const primeiro = f.maos[0];
  const [, repintar] = useState(0);

  // Um tique por dez segundos, só enquanto há fila: o tempo de espera precisa
  // andar sozinho na tela, senão ele mente — e mentir sobre quanto tempo
  // alguém está esperando é pior do que não dizer nada.
  useEffect(() => {
    if (f.maos.length === 0) return;
    const i = setInterval(() => repintar((n) => n + 1), 10_000);
    return () => clearInterval(i);
  }, [f.maos.length]);

  return (
    <div className="nv-fila">
      <button
        className={`nv-btn ${minha ? "ligado" : "principal"}`}
        onClick={() => motor?.mao(!minha)}
      >
        <MaoIcon size={16} />
        {minha ? "Abaixar a mão" : "Levantar a mão"}
      </button>

      {/* Ser o primeiro da fila é a única coisa que a ferramenta tem a dizer
          a alguém em particular, e ela dizia num negrito discreto no meio de
          uma lista. Quem esperou quatro minutos merece a frase inteira. */}
      {primeiro?.id === eu && (
        <p className="nv-fila-vez">
          <MaoIcon size={15} />É a sua vez — você é o primeiro da fila.
        </p>
      )}

      {f.maos.length === 0 ? (
        <p className="nv-nota">
          Ninguém na fila. Quem levantar a mão aparece aqui na ordem em que
          levantou — e a ordem é a mesma na tela de todo mundo.
        </p>
      ) : (
        <ol className="nv-fila-lista">
          {f.maos.map((m, i) => (
            <li
              key={m.id}
              className={`${m.id === eu ? "eu" : ""}${i === 0 ? " vez" : ""}`}
            >
              <span className="nv-fila-n">{i + 1}</span>
              {m.nome}
              {m.id === eu && <em>você</em>}
              {/* Há quanto tempo esta pessoa espera. É a informação que faz a
                  fila valer: sem ela, quem está falando não tem como saber se
                  a mão subiu agora ou há quatro minutos — e quatro minutos de
                  mão levantada é alguém que já desistiu de participar. */}
              <span className="nv-fila-espera">{espera(m.em)}</span>
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
  const contagem = q.opcoes.map(
    (_, i) => Object.values(q.votos).filter((v) => v === i).length,
  );
  const maior = Math.max(0, ...contagem);
  /**
   * Empate não tem vencedor.
   *
   * Destacar duas opções empatadas em quatro votos como "as vencedoras" é
   * dizer exatamente o contrário do que a votação decidiu — e a enquete
   * existe para decidir. Havendo empate, ninguém acende, e o número na tela
   * conta a história sozinho.
   */
  const vencedora =
    !q.aberta && maior > 0 && contagem.filter((c) => c === maior).length === 1
      ? contagem.indexOf(maior)
      : -1;

  return (
    <div className="nv-enquete">
      <p className="nv-enquete-p">{q.pergunta}</p>

      <div className="nv-enquete-ops">
        {q.opcoes.map((o, i) => {
          const votos = contagem[i];
          const pct = total > 0 ? Math.round((votos / total) * 100) : 0;
          return (
            <button
              key={i}
              className={`nv-voto${q.meuVoto === i ? " meu" : ""}${
                i === vencedora ? " venceu" : ""
              }`}
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

      {/*
        * Encerrada, a enquete ficava na tela para sempre e não havia como
        * fazer outra: a ferramenta tinha uma pergunta só por sala. Numa
        * conversa que decide três coisas, isso são duas decisões sem
        * ferramenta. Largar devolve a enquete ao estado livre, e o formulário
        * da pergunta seguinte volta sozinho.
        */}
      {souDono && !q.aberta && (
        <button className="nv-btn principal" onClick={() => motor?.largarEnquete()}>
          Nova pergunta
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────── o temporizador ──

const ATALHOS = [60, 300, 600, 900];

/**
 * O apito de fim de tempo.
 *
 * Um temporizador que acaba em silêncio não serve para nada — quem o ligou
 * está olhando para a outra pessoa, não para o painel da esquerda, e é
 * justamente por isso que ligou um relógio em vez de contar de cabeça. Antes,
 * "acabou" era uma palavra que aparecia numa gaveta que podia estar fechada.
 *
 * Dois tons curtos e baixos, feitos no próprio navegador. Um arquivo de som
 * seria mais um pedido de rede para tocar meio segundo, e um pedido que falha
 * na hora exata em que o som importa. O `AudioContext` da sala já está
 * destravado — qualquer clique destrava —, e se por acaso não estiver, o
 * `catch` engole: um apito que não sai é chato, uma exceção no meio da
 * chamada é pior.
 */
function apitar() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const agora = ctx.currentTime;
    for (const [i, hz] of [880, 660].entries()) {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.frequency.value = hz;
      osc.type = "sine";
      // A rampa existe para não estalar: um ganho que salta de 0 para 0,2 no
      // mesmo quadro produz um clique que se ouve mais que a nota.
      vol.gain.setValueAtTime(0.0001, agora + i * 0.22);
      vol.gain.exponentialRampToValueAtTime(0.18, agora + i * 0.22 + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, agora + i * 0.22 + 0.2);
      osc.connect(vol).connect(ctx.destination);
      osc.start(agora + i * 0.22);
      osc.stop(agora + i * 0.22 + 0.22);
    }
    setTimeout(() => void ctx.close(), 900);
  } catch {
    /* navegador sem áudio, ou contexto barrado */
  }
}

function Tempo({ f, motor }: { f: EstadoFerramentas; motor: Motor | null }) {
  const [, repintar] = useState(0);
  const [minutos, setMinutos] = useState("");
  const apitou = useRef(false);
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

  /**
   * O apito toca uma vez por contagem, e não uma vez por tique.
   *
   * O relógio repinta quatro vezes por segundo enquanto anda; sem a trava,
   * "acabou" seria verdade em todos os tiques a partir do zero e a sala
   * apitaria para sempre. A trava se solta quando volta a haver tempo, que é
   * o que acontece quando alguém reinicia — aí a próxima contagem apita de
   * novo, como se espera.
   */
  useEffect(() => {
    if (acabou && !apitou.current) {
      apitou.current = true;
      apitar();
    }
    if (!acabou && resta > 0) apitou.current = false;
  }, [acabou, resta]);

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

      {/*
        * Quatro atalhos cobrem quase tudo e não cobrem o resto. "Sete minutos"
        * — o tempo que sobrou da reunião, a rodada de fala de quem tem doze
        * para dividir por dois — era impossível: só dava para somar botões de
        * cinco e de um, e a soma reinicia a contagem a cada clique, então nem
        * isso funcionava.
        */}
      <form
        className="nv-tempo-livre"
        onSubmit={(e) => {
          e.preventDefault();
          const m = Number(minutos.replace(",", "."));
          if (!Number.isFinite(m) || m <= 0) return;
          // Uma hora é o teto do motor (`iniciarTempo` limita lá também, que
          // é onde a regra tem de valer para todo mundo). Aqui o corte existe
          // para o campo não prometer o que a sala não cumpre.
          motor?.iniciarTempo(Math.min(Math.round(m * 60), 3600));
          setMinutos("");
        }}
      >
        <input
          type="number"
          min={0.25}
          max={60}
          step={0.25}
          value={minutos}
          placeholder="outro"
          aria-label="Minutos"
          onChange={(e) => setMinutos(e.target.value)}
        />
        <span className="nv-rotulo">min</span>
        <button className="nv-btn" type="submit" disabled={!minutos}>
          Marcar
        </button>
      </form>

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
        acabar — dois computadores raramente concordam sobre que horas são. No
        fim, apita na tela de todo mundo.
      </p>
    </div>
  );
}
