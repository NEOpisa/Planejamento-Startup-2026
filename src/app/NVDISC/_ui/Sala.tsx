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
  ImagemIcon,
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
  capturaAviso: null,
  audioTravado: false,
  meuNivel: 0,
  qualidade: QUALIDADE_PADRAO,
};

export default function Sala({ sala }: { sala: string }) {
  const [estado, setEstado] = useState<EstadoMalha>(VAZIO);
  const [nome, setNome] = useState<string | null>(null);
  const [chatAberto, setChatAberto] = useState(false);
  /** de quem é a tela que está ocupando o palco */
  const [telaAberta, setTelaAberta] = useState<string | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  /**
   * O tema começa no padrão e é lido do `localStorage` depois de montar.
   *
   * Ler direto no `useState` quebraria a hidratação: o servidor renderiza sem
   * `localStorage` e chegaria a um valor diferente do que o navegador acha
   * na primeira passada.
   */
  const [tema, setTema] = useState("cornflower");
  const malha = useRef<Malha | null>(null);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem("nvdisc:tema");
      if (guardado) setTema(guardado);
    } catch {
      /* navegação privativa: fica o padrão */
    }
  }, []);

  function trocarTema(t: string) {
    setTema(t);
    try {
      localStorage.setItem("nvdisc:tema", t);
    } catch {
      /* vale por esta sessão */
    }
  }

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
    <div className="nv nv-fundo nv-sala" data-tema={tema}>
      <Topo
        sala={sala}
        estado={estado}
        naoLidas={naoLidas}
        onChat={() => setChatAberto((v) => !v)}
      />

      {estado.erro && <div className="nv-erro">{estado.erro}</div>}

      {/* O motor de áudio preso é o defeito mais cruel que esta sala tem: o
          microfone está aberto, a faixa está viva, e não sai nada. Ele se
          solta em qualquer clique — mas quem não sabe disso fica falando
          sozinho. Um botão explícito custa pouco e fecha o assunto. */}
      {estado.audioTravado && (
        <button
          className="nv-aviso"
          onClick={() => void malha.current?.destravarSom()}
        >
          O navegador está segurando o áudio. Clique aqui para liberar.
        </button>
      )}

      {estado.capturaAviso && !estado.audioTravado && (
        <div className="nv-aviso">{estado.capturaAviso}</div>
      )}

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
          onImagem={(f, legenda) => void malha.current?.enviarImagem(f, legenda)}
        />
      </div>

      <Controles
        estado={estado}
        tema={tema}
        onMudo={() => malha.current?.mudo(!estado.mudo)}
        onTela={() => void malha.current?.alternarTela()}
        onQualidade={(q) => void malha.current?.definirQualidade(q)}
        onMicrofone={(id) => void malha.current?.definirMicrofone(id)}
        onTema={trocarTema}
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
  onImagem,
}: {
  estado: EstadoMalha;
  aberto: boolean;
  onFechar: () => void;
  onEnviar: (t: string) => void;
  onImagem: (arquivo: File, legenda: string) => void;
}) {
  const [texto, setTexto] = useState("");
  /** a imagem escolhida, esperando o envio junto com a legenda */
  const [anexo, setAnexo] = useState<{ arquivo: File; previa: string } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  const seletor = useRef<HTMLInputElement>(null);

  /**
   * A prévia sai de um `blob:` e precisa ser devolvida.
   *
   * `createObjectURL` prende o arquivo na memória até alguém revogar. Numa
   * conversa em que se manda print atrás de print, esquecer disso é vazar a
   * imagem inteira a cada envio.
   */
  function escolher(arquivo: File | null | undefined) {
    if (!arquivo || !arquivo.type.startsWith("image/")) return;
    setAnexo((antes) => {
      if (antes) URL.revokeObjectURL(antes.previa);
      return { arquivo, previa: URL.createObjectURL(arquivo) };
    });
  }

  function largar() {
    setAnexo((antes) => {
      if (antes) URL.revokeObjectURL(antes.previa);
      return null;
    });
  }

  useEffect(() => {
    return () => {
      if (anexo) URL.revokeObjectURL(anexo.previa);
    };
  }, [anexo]);

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
    if (anexo) {
      // A legenda vai junto com a imagem, numa mensagem só: separar as duas
      // faria a legenda chegar antes ou depois, e às vezes no meio da fala de
      // outra pessoa.
      onImagem(anexo.arquivo, texto);
      largar();
      setTexto("");
      return;
    }
    if (!texto.trim()) return;
    onEnviar(texto);
    setTexto("");
  }

  return (
    <aside
      className={`nv-chat${aberto ? " aberto" : ""}${arrastando ? " arrastando" : ""}`}
      onDragOver={(e) => {
        // Sem o `preventDefault` o navegador abre a imagem numa aba nova e a
        // pessoa perde a sala.
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        escolher(e.dataTransfer.files[0]);
      }}
    >
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
              {m.imagem && <ImagemDoChat src={m.imagem} de={m.nome} />}
              {m.texto && <p className="texto">{m.texto}</p>}
            </div>
          ),
        )}
        <div ref={fim} />
      </div>

      {anexo && (
        <div className="nv-anexo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={anexo.previa} alt="" />
          <div>
            <strong>{anexo.arquivo.name}</strong>
            <span className="nv-nota">
              vai junto com o que você escrever. Imagem grande é reduzida antes
              de sair.
            </span>
          </div>
          <button type="button" onClick={largar} aria-label="tirar a imagem">
            ×
          </button>
        </div>
      )}

      <form onSubmit={enviar}>
        <input
          ref={seletor}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            escolher(e.target.files?.[0]);
            // Zerar deixa escolher o **mesmo** arquivo de novo; sem isto o
            // `change` não dispara na segunda vez e parece que o botão quebrou.
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="nv-anexar"
          onClick={() => seletor.current?.click()}
          title="mandar uma imagem (ou cole, ou arraste para cá)"
          aria-label="mandar uma imagem"
        >
          <ImagemIcon size={16} />
        </button>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onPaste={(e) => {
            // Colar print é o caminho mais usado e o único que não tem botão.
            const arquivo = [...e.clipboardData.items]
              .find((i) => i.type.startsWith("image/"))
              ?.getAsFile();
            if (arquivo) {
              e.preventDefault();
              escolher(arquivo);
            }
          }}
          placeholder={anexo ? "uma legenda? (opcional)" : "escreva algo…"}
        />
      </form>
    </aside>
  );
}

/**
 * Uma imagem recebida no chat.
 *
 * Ela abre em tamanho cheio ao ser clicada, numa camada por cima da sala —
 * e não numa aba nova. Aba nova tira a pessoa da chamada, e voltar dá trabalho
 * no celular.
 */
function ImagemDoChat({ src, de }: { src: string; de: string }) {
  const [cheia, setCheia] = useState(false);

  // Fechar com Esc: quem abriu uma imagem sobre a sala espera isso, e sem
  // teclado o único jeito de sair seria acertar a borda.
  useEffect(() => {
    if (!cheia) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCheia(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [cheia]);

  return (
    <>
      <button
        type="button"
        className="nv-img-chat"
        onClick={() => setCheia(true)}
        title="ver em tamanho cheio"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`imagem de ${de}`} loading="lazy" />
      </button>

      {cheia && (
        <div
          className="nv-lightbox"
          role="dialog"
          aria-label={`imagem de ${de}`}
          onClick={() => setCheia(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`imagem de ${de}`} />
          <span className="nv-nota">clique em qualquer lugar, ou Esc, para fechar</span>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------ controles --

function Controles({
  estado,
  tema,
  onMudo,
  onTela,
  onQualidade,
  onMicrofone,
  onTema,
}: {
  estado: EstadoMalha;
  tema: string;
  onMudo: () => void;
  onTela: () => void;
  onQualidade: (q: Partial<Qualidade>) => void;
  onMicrofone: (id: string | null) => void;
  onTema: (t: string) => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <footer className="nv-controles">
      {aberto && (
        <PainelQualidade
          q={estado.qualidade}
          estado={estado}
          tema={tema}
          microfones={estado.microfones}
          microfoneId={estado.microfoneId}
          onQualidade={onQualidade}
          onMicrofone={onMicrofone}
          onTema={onTema}
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
        Ajustes
      </button>

      <Link href={comBase("/")} className="nv-btn perigo">
        <SairIcon />
        Sair
      </Link>
    </footer>
  );
}

/**
 * O painel de ajustes, em três abas.
 *
 * Uma lista só, com tudo, obrigava a rolar por resolução de vídeo para chegar
 * ao microfone — e microfone é o que a pessoa vem procurar quando alguma
 * coisa está errada. Separar por assunto põe cada coisa a um clique, e deixa
 * o avançado existir sem atrapalhar quem só quer trocar o microfone.
 *
 * Cada aba começa pelo que a maioria mexe e termina no que quase ninguém
 * mexe, atrás de um `<details>`. Esconder o avançado não é escondê-lo de
 * quem procura: é não empurrá-lo para quem não procura.
 */
function PainelQualidade({
  q,
  estado,
  tema,
  microfones,
  microfoneId,
  onQualidade,
  onMicrofone,
  onTema,
  onFechar,
}: {
  q: Qualidade;
  estado: EstadoMalha;
  tema: string;
  microfones: { id: string; nome: string }[];
  microfoneId: string | null;
  onQualidade: (q: Partial<Qualidade>) => void;
  onMicrofone: (id: string | null) => void;
  onTema: (t: string) => void;
  onFechar: () => void;
}) {
  const [aba, setAba] = useState<"transmissao" | "microfone" | "tema">("microfone");

  return (
    <div className="nv-painel nv-cantos">
      <header>
        <span className="nv-eyebrow">Ajustes</span>
        <button onClick={onFechar} aria-label="fechar">
          ×
        </button>
      </header>

      <nav className="nv-abas" role="tablist">
        {(
          [
            ["microfone", "Microfone"],
            ["transmissao", "Transmissão"],
            ["tema", "Personalização"],
          ] as const
        ).map(([v, r]) => (
          <button
            key={v}
            role="tab"
            aria-selected={aba === v}
            className={`nv-aba${aba === v ? " ativa" : ""}`}
            onClick={() => setAba(v)}
          >
            {r}
          </button>
        ))}
      </nav>

      {aba === "microfone" && (
        <AbaMicrofone
          q={q}
          estado={estado}
          microfones={microfones}
          microfoneId={microfoneId}
          onQualidade={onQualidade}
          onMicrofone={onMicrofone}
        />
      )}
      {aba === "transmissao" && <AbaTransmissao q={q} onQualidade={onQualidade} />}
      {aba === "tema" && <AbaTema tema={tema} onTema={onTema} />}
    </div>
  );
}

// ------------------------------------------------------- aba: microfone --

function AbaMicrofone({
  q,
  estado,
  microfones,
  microfoneId,
  onQualidade,
  onMicrofone,
}: {
  q: Qualidade;
  estado: EstadoMalha;
  microfones: { id: string; nome: string }[];
  microfoneId: string | null;
  onQualidade: (q: Partial<Qualidade>) => void;
  onMicrofone: (id: string | null) => void;
}) {
  return (
    <>
      <div className="grupo">
        <span className="nv-rotulo">Entrada</span>
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
              sempre é a que tem alguém falando na frente. A troca é na hora —
              ninguém na sala percebe.
            </p>
          </>
        )}
      </div>

      {/* O medidor é a peça que faz o resto desta aba ser regulável em vez de
          adivinhável: sem ver o nível, escolher um limiar é chute. */}
      <div className="grupo">
        <span className="nv-rotulo">Nível de entrada</span>
        <Medidor nivel={estado.meuNivel} limiar={q.ruido === "forte" ? q.limiar : null} />
        <p className="nv-nota">
          {estado.mudo
            ? "O microfone está desligado — ligue para ver o nível."
            : estado.meuNivel > 0.5
              ? "Bem alto. Se estiver estourando, baixe o reforço no avançado."
              : estado.meuNivel > 0.02
                ? "Captando."
                : "Nada entrando. Fale algo; se a barra não mexer, troque a entrada acima."}
        </p>
      </div>

      <div className="grupo">
        <Escolha
          titulo="Modo"
          valor={q.audio}
          opcoes={[
            { v: "voz", r: "Voz" },
            { v: "musica", r: "Música" },
          ]}
          onEscolher={(v) => onQualidade({ audio: v as Qualidade["audio"] })}
        />
        <p className="nv-nota" style={{ marginTop: 8 }}>
          {q.audio === "voz"
            ? "Cancelamento de eco e supressão ligados, mono, 96 kbps. É o que evita microfonia em quem usa alto-falante."
            : "Estéreo a 256 kbps, sem processamento. Instrumento e vídeo passam inteiros — mas peça fone a todo mundo, senão vira realimentação."}
        </p>
        <p className="nv-nota">
          Os dois botões são atalhos: eles escrevem o avançado de uma vez, e o
          que você mexer depois vale sobre eles.
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
            ? "Nada é tirado do som. É o certo quando o que importa não é a fala."
            : q.ruido === "padrao"
              ? "O supressor do navegador tira ventilador, teclado e chiado sem encostar na voz."
              : "Além do supressor, o microfone fica fechado enquanto você não fala. Regule o limiar no avançado, olhando o medidor."}
        </p>
      </div>

      <details className="nv-avancado">
        <summary>Avançado</summary>

        <Chave
          titulo="Cancelamento de eco"
          ligado={q.eco}
          onMudar={(v) => onQualidade({ eco: v })}
          nota="Impede que o seu alto-falante volte para a sala. Desligue só de fone — ele come agudo, e para instrumento isso pesa."
        />

        <Chave
          titulo="Ganho automático"
          ligado={q.ganhoAuto}
          onMudar={(v) => onQualidade({ ganhoAuto: v })}
          nota="Nivela quem fala baixo e quem grita. Em compensação levanta o silêncio junto: com ruído de fundo, ele sobe o ventilador quando ninguém fala."
        />

        <Deslizante
          titulo="Reforço de entrada"
          valor={q.ganho}
          min={-12}
          max={18}
          passo={1}
          formatar={(v) => `${v > 0 ? "+" : ""}${v} dB`}
          onMudar={(v) => onQualidade({ ganho: v })}
          nota="Para o microfone que o sistema entrega baixo demais e não tem onde subir. É ganho linear: amplifica o ruído junto, então é remédio para sinal fraco, não para sala barulhenta."
        />

        {q.ruido === "forte" && (
          <Deslizante
            titulo="Limiar da porta"
            valor={Math.round(q.limiar * 1000)}
            min={0}
            max={150}
            passo={5}
            formatar={(v) => (v / 1000).toFixed(3)}
            onMudar={(v) => onQualidade({ limiar: v / 1000 })}
            nota="Abaixo deste nível o microfone fica fechado. Olhe o medidor acima: ponha o limiar logo em cima do ruído de fundo e abaixo da sua voz. Alto demais corta o começo das palavras."
          />
        )}

        <Deslizante
          titulo="Taxa da voz"
          valor={q.taxaVoz}
          min={24}
          max={320}
          passo={8}
          formatar={(v) => `${v} kbps`}
          onMudar={(v) => onQualidade({ taxaVoz: v })}
          nota="O padrão do WebRTC é ~32 kbps, que é o som de telefone. Acima de 128 o ganho fica difícil de ouvir em voz; para música, vale ir alto. Só entra por inteiro na próxima negociação."
        />

        <Chave
          titulo="Cortar transmissão no silêncio"
          ligado={q.dtx}
          onMudar={(v) => onQualidade({ dtx: v })}
          nota="Economiza banda de verdade e come o começo das palavras ditas baixinho. Ligue só em rede muito apertada."
        />
      </details>
    </>
  );
}

// ----------------------------------------------------- aba: transmissão --

function AbaTransmissao({
  q,
  onQualidade,
}: {
  q: Qualidade;
  onQualidade: (q: Partial<Qualidade>) => void;
}) {
  return (
    <>
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
          onEscolher={(v) => onQualidade({ resolucao: Number(v) as Qualidade["resolucao"] })}
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
        <p className="nv-nota" style={{ marginTop: 8 }}>
          60 custa cerca de 60% mais banda. Vale para jogo e vídeo; para código
          e planilha, 30 é indistinguível.
        </p>
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

      <div className="grupo">
        <Chave
          titulo="Mandar o som da tela"
          ligado={q.somDaTela}
          onMudar={(v) => onQualidade({ somDaTela: v })}
          nota="O áudio da captura vai misturado à sua voz, numa faixa só. Só o Chrome entrega esse som, e só ao compartilhar uma aba."
        />
      </div>

      <details className="nv-avancado">
        <summary>Avançado</summary>

        <Deslizante
          titulo="Teto de subida"
          valor={q.tetoVideo}
          min={0}
          max={20000}
          passo={500}
          formatar={(v) => (v === 0 ? "automático" : `${(v / 1000).toFixed(1)} Mbps`)}
          onMudar={(v) => onQualidade({ tetoVideo: v })}
          nota="Quanto o vídeo pode gastar no total, dividido entre as pessoas da sala. Se você sabe a sua subida, ponha um pouco abaixo dela: estourar não degrada aos poucos, enfileira e trava tudo de uma vez — inclusive a voz."
        />
      </details>

      <div className="rodape">
        <p className="nv-nota">
          A sua conexão manda{" "}
          <strong style={{ color: "var(--txt-2)" }}>uma cópia para cada pessoa</strong>{" "}
          na sala. Com muita gente, a taxa é dividida sozinha para não estourar
          a sua subida.
        </p>
      </div>
    </>
  );
}

// -------------------------------------------------- aba: personalização --

/**
 * Os temas.
 *
 * Todos saem da paleta da marca — não são cores inventadas aqui. O que muda é
 * o acento e o brilho do fundo; as superfícies continuam as mesmas, porque é
 * delas que vem a legibilidade, e trocar o contraste do texto por gosto é
 * como se produz uma interface bonita que ninguém consegue ler.
 */
const TEMAS = [
  { v: "cornflower", r: "Cornflower", cor: "#6495ed" },
  { v: "ambar", r: "Âmbar", cor: "#f4b74a" },
  { v: "esmeralda", r: "Esmeralda", cor: "#3ef08a" },
  { v: "gelo", r: "Gelo", cor: "#67e8f9" },
  { v: "violeta", r: "Violeta", cor: "#a78bfa" },
  { v: "carmim", r: "Carmim", cor: "#fb7185" },
] as const;

function AbaTema({ tema, onTema }: { tema: string; onTema: (t: string) => void }) {
  return (
    <>
      <div className="grupo">
        <span className="nv-rotulo">Cor de acento</span>
        <div className="nv-temas">
          {TEMAS.map((t) => (
            <button
              key={t.v}
              className={`nv-tema${tema === t.v ? " ativo" : ""}`}
              onClick={() => onTema(t.v)}
              aria-pressed={tema === t.v}
              title={t.r}
            >
              <span style={{ background: t.cor }} aria-hidden />
              {t.r}
            </button>
          ))}
        </div>
        <p className="nv-nota" style={{ marginTop: 10 }}>
          Vale só para você, neste navegador — a sala de quem está do outro
          lado não muda. Fica guardado entre visitas.
        </p>
      </div>
    </>
  );
}

// ------------------------------------------------------------ controles --

/** Uma chave de liga/desliga com a explicação embaixo. */
function Chave({
  titulo,
  ligado,
  onMudar,
  nota,
}: {
  titulo: string;
  ligado: boolean;
  onMudar: (v: boolean) => void;
  nota?: string;
}) {
  return (
    <div className="nv-campo">
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        className={`nv-chave${ligado ? " ligada" : ""}`}
        onClick={() => onMudar(!ligado)}
      >
        <span className="nv-chave-trilho" aria-hidden>
          <span className="nv-chave-bola" />
        </span>
        {titulo}
      </button>
      {nota && <p className="nv-nota">{nota}</p>}
    </div>
  );
}

/** Um deslizante com o valor escrito ao lado — sem ele, ninguém sabe onde está. */
function Deslizante({
  titulo,
  valor,
  min,
  max,
  passo,
  formatar,
  onMudar,
  nota,
}: {
  titulo: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  formatar: (v: number) => string;
  onMudar: (v: number) => void;
  nota?: string;
}) {
  return (
    <div className="nv-campo">
      <div className="nv-campo-topo">
        <span className="nv-rotulo">{titulo}</span>
        <output>{formatar(valor)}</output>
      </div>
      <input
        type="range"
        className="nv-range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        onChange={(e) => onMudar(Number(e.target.value))}
      />
      {nota && <p className="nv-nota">{nota}</p>}
    </div>
  );
}

/**
 * A barra de nível, com a marca do limiar em cima.
 *
 * As duas coisas na mesma régua de propósito: o limiar só quer dizer alguma
 * coisa em relação ao que está entrando, e mostrá-los separados devolveria o
 * problema que este medidor existe para resolver.
 */
function Medidor({ nivel, limiar }: { nivel: number; limiar: number | null }) {
  // Raiz quadrada: o ouvido é logarítmico e uma escala linear deixa toda a
  // fala normal espremida no primeiro quinto da barra.
  const pos = (v: number) => `${Math.min(100, Math.sqrt(Math.min(1, v)) * 100)}%`;
  return (
    <div className="nv-medidor">
      <div className="nv-medidor-barra" style={{ width: pos(nivel) }} />
      {limiar !== null && (
        <div
          className="nv-medidor-limiar"
          style={{ left: pos(limiar) }}
          title="limiar da porta de ruído"
        />
      )}
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
