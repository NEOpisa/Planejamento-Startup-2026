"use client";

/**
 * A sala.
 *
 * Três áreas: quem está aqui (com indicador de quem está falando), o que está
 * sendo compartilhado, e o chat. A lógica de rede inteira mora na [`Malha`];
 * este arquivo só desenha o que ela reporta e chama os métodos dela — é o que
 * permite mexer na interface sem risco de quebrar a chamada, e vice-versa.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  Malha,
  QUALIDADE_PADRAO,
  type EstadoMalha,
  type Participante,
  type Qualidade,
} from "@/lib/malha";
import { limparNome } from "@/lib/protocolo.mjs";
import {
  MicIcon,
  MicOffIcon,
  TelaIcon,
  PararIcon,
  AjustesIcon,
  SairIcon,
  AlertaIcon,
  ExpandirIcon,
} from "@/components/icons";
import { comBase } from "@/lib/base.mjs";
import "../nvdisc.css";

const VAZIO: EstadoMalha = {
  voceId: null,
  ligado: false,
  erro: null,
  participantes: [],
  mensagens: [],
  mudo: false,
  tela: false,
  meuVolume: 0,
  telaComSom: false,
  microfones: [],
  microfoneId: null,
  qualidade: QUALIDADE_PADRAO,
};

export default function Sala({ sala }: { sala: string }) {
  const [estado, setEstado] = useState<EstadoMalha>(VAZIO);
  const [nome, setNome] = useState<string | null>(null);
  const [chatAberto, setChatAberto] = useState(false);
  /** de quem é a tela que está ocupando o palco */
  const [telaAberta, setTelaAberta] = useState<string | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const malha = useRef<Malha | null>(null);

  useEffect(() => {
    const guardado = limparNome(localStorage.getItem("nvdisc:nome"));
    if (!guardado) {
      // Sem nome não dá para entrar, e mandar de volta para a entrada com o
      // código já preenchido é mais gentil que um formulário no meio da sala.
      location.replace(comBase(`/?sala=${encodeURIComponent(sala)}`));
      return;
    }
    setNome(guardado);

    const m = new Malha(setEstado);
    malha.current = m;
    void m.entrar(sala, guardado);
    // Sair de verdade ao fechar a aba: sem isto o participante fica de fantasma
    // na lista dos outros até a varredura do servidor derrubá-lo.
    const aoFechar = () => m.sair();
    window.addEventListener("pagehide", aoFechar);
    return () => {
      window.removeEventListener("pagehide", aoFechar);
      m.sair();
    };
  }, [sala]);

  const compartilhando = useMemo(
    () => estado.participantes.filter((p) => p.tela && p.video),
    [estado.participantes],
  );
  const temTela = compartilhando.length > 0 || estado.tela;

  /**
   * `M` liga e desliga o microfone.
   *
   * Só quando o foco não está num campo de texto — senão escrever "amanhã" no
   * chat mutaria a pessoa no meio da palavra, e ela levaria um tempo até
   * entender por quê.
   */
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "m" || e.metaKey || e.ctrlKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(input|textarea)$/i.test(alvo.tagName)) return;
      if (alvo?.isContentEditable) return;
      e.preventDefault();
      malha.current?.mudo(!estado.mudo);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [estado.mudo]);

  // No celular o chat vive escondido; o contador existe para a pessoa saber que
  // perdeu alguma coisa sem precisar abrir para conferir.
  const ultimaVista = useRef(0);
  useEffect(() => {
    const reais = estado.mensagens.filter((m) => !m.sistema).length;
    if (chatAberto) {
      ultimaVista.current = reais;
      setNaoLidas(0);
    } else {
      setNaoLidas(Math.max(0, reais - ultimaVista.current));
    }
  }, [estado.mensagens, chatAberto]);

  if (!nome) return null;

  return (
    <div className="nv nv-fundo nv-sala">
      <Topo
        sala={sala}
        estado={estado}
        naoLidas={naoLidas}
        onChat={() => setChatAberto((v) => !v)}
      />

      {estado.erro && <div className="nv-erro">{estado.erro}</div>}

      <div className="nv-corpo">
        <main className="nv-palco">
          <Palco
            compartilhando={compartilhando}
            minhaTela={estado.tela ? malha.current?.minhaTela ?? null : null}
            estado={estado}
            nome={nome}
            aberta={telaAberta}
            onAbrir={setTelaAberta}
          />
          {/* A tirinha embaixo só existe quando o palco está ocupado por uma
              tela; sem ela, as pessoas **são** o palco. */}
          {temTela && <Pessoas estado={estado} nome={nome} variante="faixa" />}
        </main>

        <Chat
          estado={estado}
          aberto={chatAberto}
          onFechar={() => setChatAberto(false)}
          onEnviar={(t) => malha.current?.enviarChat(t)}
        />
      </div>

      <Controles
        estado={estado}
        onMudo={() => malha.current?.mudo(!estado.mudo)}
        onTela={() => void malha.current?.alternarTela()}
        onQualidade={(q) => void malha.current?.definirQualidade(q)}
        onMicrofone={(id) => void malha.current?.definirMicrofone(id)}
      />
    </div>
  );
}

// ---------------------------------------------------------------- topo --

function Topo({
  sala,
  estado,
  naoLidas,
  onChat,
}: {
  sala: string;
  estado: EstadoMalha;
  naoLidas: number;
  onChat: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}${comBase(`/?sala=${encodeURIComponent(sala)}`)}`,
      );
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* sem permissão de área de transferência */
    }
  }

  return (
    <header className="nv-topo">
      <Link href={comBase("/")} className="marca">
        NV<b>DISC</b>
      </Link>

      <span className="codigo">{sala}</span>
      <button className="nv-mini" onClick={copiar}>
        {copiado ? "link copiado" : "copiar convite"}
      </button>

      <div className="direita">
        <button className="nv-mini nv-so-mobile" onClick={onChat}>
          chat
          {naoLidas > 0 && <span className="nv-selo">{naoLidas > 9 ? "9+" : naoLidas}</span>}
        </button>
        <div className="nv-estado">
          <span className={`nv-ponto${estado.ligado ? "" : " off"}`} aria-hidden />
          {estado.ligado ? `${estado.participantes.length + 1} na sala` : "reconectando…"}
        </div>
      </div>
    </header>
  );
}

// ----------------------------------------------------------------- som --

/**
 * O áudio de uma pessoa.
 *
 * Sem isto **não há voz**: o WebRTC entrega um `MediaStream`, e um fluxo que
 * não está ligado a nenhum elemento não toca. Não é detalhe de interface — é a
 * diferença entre a chamada funcionar e todo mundo entrar numa sala silenciosa
 * achando que o microfone do outro está com defeito.
 */
function Som({ fluxo, nome }: { fluxo: MediaStream; nome: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = fluxo;
    // O navegador pode recusar tocar sozinho: a permissão de reprodução
    // automática se perde na navegação entre a entrada e a sala. Recusa não é
    // erro — é um caso a tratar, com um botão que o usuário clica.
    el.play().then(
      () => setBloqueado(false),
      () => setBloqueado(true),
    );
  }, [fluxo]);

  return (
    <>
      <audio ref={ref} autoPlay playsInline />
      {bloqueado && (
        <button
          className="nv-mini"
          style={{ borderColor: "var(--alerta)", color: "var(--alerta)" }}
          onClick={() => void ref.current?.play().then(() => setBloqueado(false))}
        >
          ouvir {nome}
        </button>
      )}
    </>
  );
}

// --------------------------------------------------------------- palco --

function Palco({
  compartilhando,
  minhaTela,
  estado,
  nome,
  aberta,
  onAbrir,
}: {
  compartilhando: Participante[];
  minhaTela: MediaStream | null;
  estado: EstadoMalha;
  nome: string;
  aberta: string | null;
  onAbrir: (id: string | null) => void;
}) {
  /**
   * As telas que existem agora, em ordem estável.
   *
   * A sua vem primeiro porque é a que você confere ("estou mostrando o que
   * queria mostrar?"), e não porque seja a mais importante para quem assiste.
   */
  const telas = [
    ...(minhaTela
      ? [{ id: "eu", quem: "você", fluxo: minhaTela, som: estado.telaComSom }]
      : []),
    ...compartilhando.map((p) => ({
      id: p.id,
      quem: p.nome,
      fluxo: p.video!,
      som: null,
    })),
  ];

  // **Sem tela compartilhada, quem ocupa o palco são as pessoas.**
  //
  // Numa chamada de voz — que é o caso comum — ninguém está mostrando nada, e
  // deixar o meio da tela vazio com um aviso enquanto os participantes se
  // espremem numa faixa de 60 px embaixo é desperdiçar a tela inteira para
  // dizer que não há nada nela.
  if (telas.length === 0) {
    return (
      <>
        <Pessoas estado={estado} nome={nome} variante="grade" />
        {/* Alguém marcou que está compartilhando e a imagem ainda não chegou.
            Sem esta linha, a tela fica vazia e parece defeito — quando é só a
            negociação do vídeo levando alguns segundos. */}
        {estado.participantes.some((p) => p.tela && !p.video) && (
          <p className="nv-nota nv-vazio">
            {estado.participantes.find((p) => p.tela && !p.video)?.nome} começou a
            compartilhar a tela; a imagem aparece aqui em instantes.
          </p>
        )}
      </>
    );
  }

  // A escolhida, ou a primeira — e a primeira também quando quem estava sendo
  // assistido parou de compartilhar, para o palco nunca ficar preto por causa
  // de uma escolha que não existe mais.
  const atual = telas.find((t) => t.id === aberta) ?? telas[0];

  return (
    <>
      <BarraDeTelas telas={telas} atual={atual.id} onAbrir={onAbrir} />
      <div className="nv-telas uma">
        <Tela fluxo={atual.fluxo} legenda={atual.quem} />
      </div>
    </>
  );
}

/**
 * A barra das telas compartilhadas.
 *
 * Ela existe mesmo quando há uma tela só, e isso é de propósito: é ela que
 * responde "onde eu entro na tela que fulano está mostrando?" — pergunta que
 * a grade anterior não respondia, porque simplesmente empilhava tudo e
 * ninguém sabia que dava para agir ali.
 */
function BarraDeTelas({
  telas,
  atual,
  onAbrir,
}: {
  telas: { id: string; quem: string; som: boolean | null }[];
  atual: string;
  onAbrir: (id: string) => void;
}) {
  return (
    <section className="nv-barra-telas" aria-label="Telas compartilhadas">
      <span className="nv-rotulo">Telas compartilhadas</span>
      <ul>
        {telas.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className={`nv-aba-tela${t.id === atual ? " ativa" : ""}`}
              onClick={() => onAbrir(t.id)}
              aria-current={t.id === atual ? "true" : undefined}
            >
              <TelaIcon size={14} />
              {t.quem}
            </button>
            {/* Só a própria captura sabe dizer se veio com som; a dos outros
                chega pronta e não há como perguntar. */}
            {t.som === false && (
              <span className="nv-sem-som" title="o navegador não mandou o áudio desta captura">
                sem som
              </span>
            )}
          </li>
        ))}
      </ul>
      {telas.length > 1 && (
        <span className="nv-nota">clique para trocar de tela</span>
      )}
    </section>
  );
}

function Tela({ fluxo, legenda }: { fluxo: MediaStream; legenda: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const moldura = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = fluxo;
  }, [fluxo]);

  /**
   * Abrir a tela em tela cheia.
   *
   * O palco divide o espaço com as pessoas e com o chat, e uma janela de
   * código compartilhada num monitor grande chega aqui pequena demais para se
   * ler. Sem um jeito de ampliar, quem está do outro lado pede "aumenta a
   * letra" — e o problema não era a letra.
   */
  function ampliar() {
    const alvo = moldura.current;
    if (!alvo) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void alvo.requestFullscreen?.().catch(() => {
      // Navegador que recusa tela cheia (iOS, sobretudo): o vídeo tem o seu
      // próprio modo, e é melhor que nada.
      void (ref.current as unknown as { webkitEnterFullscreen?: () => void })
        ?.webkitEnterFullscreen?.();
    });
  }

  return (
    <figure className="nv-tela" ref={moldura}>
      {/* **Sempre** sem som. O áudio de cada pessoa — microfone e som da tela
          compartilhada — sai pelo `<Som>` dela na lista de participantes. Se
          saísse também por aqui, quem compartilhasse seria ouvido em dobro,
          com um eco de alguns milissegundos entre as duas cópias. */}
      <video ref={ref} autoPlay playsInline muted onDoubleClick={ampliar} />
      <figcaption>{legenda}</figcaption>
      <button
        type="button"
        className="nv-ampliar"
        onClick={ampliar}
        title="abrir em tela cheia (ou dê dois cliques na tela)"
        aria-label="abrir em tela cheia"
      >
        <ExpandirIcon size={15} />
      </button>
    </figure>
  );
}

// ------------------------------------------------------------- pessoas --

function Pessoas({
  estado,
  nome,
  variante,
}: {
  estado: EstadoMalha;
  nome: string;
  variante: "grade" | "faixa";
}) {
  const grade = variante === "grade";
  const gente = (
    <>
      <Pessoa
        nome={nome}
        volume={estado.meuVolume}
        mudo={estado.mudo}
        tela={estado.tela}
        grande={grade}
        eu
      />
      {estado.participantes.map((p) => (
        <Pessoa
          key={p.id}
          nome={p.nome}
          volume={p.volume}
          mudo={p.mudo}
          tela={p.tela}
          conexao={p.conexao}
          fluxo={p.audio}
          grande={grade}
        />
      ))}
    </>
  );

  if (!grade) {
    return (
      <section className="nv-pessoas-faixa">
        <ul className="nv-gente faixa">{gente}</ul>
      </section>
    );
  }

  return (
    <section className="nv-pessoas-grade">
      <ul className="nv-gente">{gente}</ul>
      {estado.participantes.length === 0 && (
        <p className="nv-nota nv-vazio">
          Só você por aqui. Mande o link do{" "}
          <strong style={{ color: "var(--txt-2)" }}>copiar convite</strong> para
          quem quiser chamar — quem abrir cai direto nesta sala.
        </p>
      )}
    </section>
  );
}

function Pessoa({
  nome,
  volume,
  mudo,
  tela,
  eu,
  conexao,
  fluxo,
  grande,
}: {
  nome: string;
  volume: number;
  mudo: boolean;
  tela: boolean;
  eu?: boolean;
  conexao?: Participante["conexao"];
  fluxo?: MediaStream;
  grande?: boolean;
}) {
  const falando = volume > 0.06 && !mudo;
  // Só o que der problema aparece. Um selo "conectado" em cada pessoa o tempo
  // todo é ruído — o silêncio já quer dizer que está tudo bem.
  const problema =
    conexao && conexao !== "connected" && conexao !== "aguardando" ? conexao : null;

  return (
    <li className={`nv-pessoa${grande ? " grande" : ""}${falando ? " falando" : ""}`}>
      <span className="nv-avatar">
        {nome.slice(0, 1).toUpperCase()}
        {falando && (
          <span
            aria-hidden
            className="nv-anel"
            style={{ transform: `scale(${1 + volume * 0.3})` }}
          />
        )}
      </span>

      <span className="nv-nome">
        {nome}
        {eu && <span>(você)</span>}
      </span>

      <span className="nv-icones">
        {mudo && (
          <span title="microfone desligado" aria-label="microfone desligado">
            <MicOffIcon size={14} />
          </span>
        )}
        {tela && (
          <span title="mostrando a tela" aria-label="mostrando a tela">
            <TelaIcon size={14} />
          </span>
        )}
        {problema && (
          <span style={{ color: "var(--alerta)" }} title={`conexão: ${problema}`}>
            <AlertaIcon size={14} />
          </span>
        )}
      </span>

      {/* o alto-falante desta pessoa; sem ele a sala é muda */}
      {fluxo && !eu && <Som fluxo={fluxo} nome={nome} />}
    </li>
  );
}

// ---------------------------------------------------------------- chat --

function Chat({
  estado,
  aberto,
  onFechar,
  onEnviar,
}: {
  estado: EstadoMalha;
  aberto: boolean;
  onFechar: () => void;
  onEnviar: (t: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    // Só acompanha o fim se já estava no fim: puxar a rolagem de quem está
    // lendo mensagem antiga é a coisa mais irritante que um chat faz.
    const noFim = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (noFim) fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [estado.mensagens]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    onEnviar(texto);
    setTexto("");
  }

  return (
    <aside className={`nv-chat${aberto ? " aberto" : ""}`}>
      <h2>
        Chat
        <button onClick={onFechar} aria-label="fechar o chat" className="nv-so-mobile">
          ×
        </button>
      </h2>

      <div className="rolagem" ref={rolagem}>
        {estado.mensagens.length === 0 && (
          <p className="nv-nota">
            Nada dito ainda. O que for escrito aqui vive só enquanto a sala
            existir — nada é gravado.
          </p>
        )}
        {estado.mensagens.map((m) =>
          m.sistema ? (
            <p key={m.id} className="sistema">
              {m.texto}
            </p>
          ) : (
            <div key={m.id}>
              <div className="quem">
                <b className={m.de === estado.voceId ? "eu" : undefined}>{m.nome}</b>
                <time>
                  {new Date(m.em).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <p className="texto">{m.texto}</p>
            </div>
          ),
        )}
        <div ref={fim} />
      </div>

      <form onSubmit={enviar}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="escreva algo…"
        />
      </form>
    </aside>
  );
}

// ------------------------------------------------------------ controles --

function Controles({
  estado,
  onMudo,
  onTela,
  onQualidade,
  onMicrofone,
}: {
  estado: EstadoMalha;
  onMudo: () => void;
  onTela: () => void;
  onQualidade: (q: Partial<Qualidade>) => void;
  onMicrofone: (id: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <footer className="nv-controles">
      {aberto && (
        <PainelQualidade
          q={estado.qualidade}
          microfones={estado.microfones}
          microfoneId={estado.microfoneId}
          onQualidade={onQualidade}
          onMicrofone={onMicrofone}
          onFechar={() => setAberto(false)}
        />
      )}

      <button className={`nv-btn${estado.mudo ? " perigo" : ""}`} onClick={onMudo}>
        {estado.mudo ? <MicOffIcon /> : <MicIcon />}
        {estado.mudo ? "Ligar microfone" : "Microfone ligado"}
        <kbd>M</kbd>
      </button>

      <button className={`nv-btn${estado.tela ? " ligado" : ""}`} onClick={onTela}>
        {estado.tela ? <PararIcon /> : <TelaIcon />}
        {estado.tela ? "Parar de compartilhar" : "Compartilhar tela"}
      </button>

      <button
        className={`nv-btn${aberto ? " ligado" : ""}`}
        onClick={() => setAberto((v) => !v)}
      >
        <AjustesIcon />
        Qualidade
      </button>

      <Link href={comBase("/")} className="nv-btn perigo">
        <SairIcon />
        Sair
      </Link>
    </footer>
  );
}

function PainelQualidade({
  q,
  microfones,
  microfoneId,
  onQualidade,
  onMicrofone,
  onFechar,
}: {
  q: Qualidade;
  microfones: { id: string; nome: string }[];
  microfoneId: string | null;
  onQualidade: (q: Partial<Qualidade>) => void;
  onMicrofone: (id: string | null) => void;
  onFechar: () => void;
}) {
  return (
    <div className="nv-painel nv-cantos">
      <header>
        <span className="nv-eyebrow">Qualidade</span>
        <button onClick={onFechar} aria-label="fechar">
          ×
        </button>
      </header>

      {/* Primeiro grupo de propósito: quando não se ouve alguém, o
          microfone é a primeira coisa a conferir, não a última. */}
      <div className="grupo">
        <span className="nv-rotulo">Microfone</span>
        {microfones.length === 0 ? (
          <p className="nv-nota" style={{ marginTop: 8 }}>
            A lista aparece depois que você dá a permissão do microfone.
          </p>
        ) : (
          <>
            <select
              className="nv-select"
              value={microfoneId ?? ""}
              onChange={(e) => onMicrofone(e.target.value || null)}
            >
              <option value="">Padrão do sistema</option>
              {microfones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
            <p className="nv-nota" style={{ marginTop: 8 }}>
              Um PC costuma ter mais de uma entrada, e a padrão do sistema nem
              sempre é a que tem alguém falando na frente. Se ninguém te ouve e
              o seu anel não acende quando você fala, é aqui. A troca é na hora
              — ninguém na sala percebe.
            </p>
          </>
        )}
      </div>

      <div className="grupo">
        <Escolha
          titulo="Som"
          valor={q.audio}
          opcoes={[
            { v: "voz", r: "Voz" },
            { v: "musica", r: "Música" },
          ]}
          onEscolher={(v) => onQualidade({ audio: v as Qualidade["audio"] })}
        />
        <p className="nv-nota" style={{ marginTop: 8 }}>
          {q.audio === "voz"
            ? "Cancelamento de eco e supressão de ruído ligados. É o que evita microfonia em quem usa alto-falante."
            : "Estéreo, sem processamento, taxa alta. Instrumento e vídeo passam inteiros — mas peça fone a todo mundo, senão vira realimentação."}
        </p>
      </div>

      <div className="grupo">
        <Escolha
          titulo="Ruído de fundo"
          valor={q.ruido}
          opcoes={[
            { v: "desligado", r: "Não filtrar" },
            { v: "padrao", r: "Padrão" },
            { v: "forte", r: "Forte" },
          ]}
          onEscolher={(v) => onQualidade({ ruido: v as Qualidade["ruido"] })}
        />
        <p className="nv-nota" style={{ marginTop: 8 }}>
          {q.ruido === "desligado"
            ? "Nada é tirado do som. É o certo quando o que importa não é a fala: instrumento, vídeo, uma voz cantando."
            : q.ruido === "padrao"
              ? "O supressor do navegador tira ventilador, teclado e chiado sem encostar na voz. Serve para quase todo mundo."
              : "Além do supressor, o microfone fica fechado enquanto você não fala. Resolve obra na rua e cachorro no quintal — e cobra: começo de palavra dita baixinho pode se perder, e respiração some."}
        </p>
      </div>

      <div className="grupo">
        <Escolha
          titulo="Resolução da tela"
          valor={String(q.resolucao)}
          opcoes={[
            { v: "720", r: "720p" },
            { v: "1080", r: "1080p" },
            { v: "1440", r: "1440p" },
            { v: "2160", r: "4K" },
            { v: "0", r: "Original" },
          ]}
          onEscolher={(v) =>
            onQualidade({ resolucao: Number(v) as Qualidade["resolucao"] })
          }
        />
      </div>

      <div className="grupo">
        <Escolha
          titulo="Quadros"
          valor={String(q.fps)}
          opcoes={[
            { v: "30", r: "30 fps" },
            { v: "60", r: "60 fps" },
          ]}
          onEscolher={(v) => onQualidade({ fps: Number(v) as Qualidade["fps"] })}
        />
      </div>

      <div className="grupo">
        <Escolha
          titulo="Ao apertar a banda"
          valor={q.perfil}
          opcoes={[
            { v: "nitidez", r: "Manter nitidez" },
            { v: "movimento", r: "Manter fluidez" },
          ]}
          onEscolher={(v) => onQualidade({ perfil: v as Qualidade["perfil"] })}
        />
        <p className="nv-nota" style={{ marginTop: 8 }}>
          {q.perfil === "nitidez"
            ? "Segura a resolução e deixa cair os quadros. É o certo para código, planilha e slide — texto borrado não se lê."
            : "Segura os quadros e deixa cair a resolução. É o certo para vídeo e jogo, onde o que incomoda é o soluço."}
        </p>
      </div>

      <div className="rodape">
        <p className="nv-nota">
          A sua conexão manda{" "}
          <strong style={{ color: "var(--txt-2)" }}>uma cópia para cada pessoa</strong>{" "}
          na sala. Com muita gente, a taxa é dividida sozinha para não estourar a
          sua subida — estourar não degrada aos poucos, trava tudo de uma vez,
          inclusive a voz.
        </p>
      </div>
    </div>
  );
}

function Escolha({
  titulo,
  valor,
  opcoes,
  onEscolher,
}: {
  titulo: string;
  valor: string;
  opcoes: { v: string; r: string }[];
  onEscolher: (v: string) => void;
}) {
  return (
    <div>
      <span className="nv-rotulo">{titulo}</span>
      <div className="nv-opcoes">
        {opcoes.map((o) => (
          <button
            key={o.v}
            className={`nv-opcao${valor === o.v ? " ativa" : ""}`}
            onClick={() => onEscolher(o.v)}
          >
            {o.r}
          </button>
        ))}
      </div>
    </div>
  );
}
