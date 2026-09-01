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
  aoPrimeiroGesto,
  criarReforco,
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
  VolumeIcon,
  FecharIcon,
  FerramentasIcon,
  QuadroIcon,
  ChatIcon,
} from "@/components/icons";
import { comBase } from "@/lib/base.mjs";
import {
  corDaPessoa,
  guardarPreferencias,
  lerPreferencias,
  PREFERENCIAS_PADRAO,
  TEMAS,
  type Preferencias,
} from "@/lib/preferencias";
import PainelFerramentas from "./Ferramentas";
import { MiniaturaQuadro, QuadroPalco, PINCEL_PADRAO, type Pincel } from "./Quadro";
import { Ferramentas, type EstadoFerramentas, type IdFerramenta, type Traco } from "@/lib/ferramentas";
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
  volumes: {},
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
   * As preferências começam no padrão e são lidas depois de montar.
   *
   * Ler direto no `useState` quebraria a hidratação: o servidor renderiza sem
   * `localStorage` e chegaria a um valor diferente do que o navegador acha na
   * primeira passada — e o sintoma disso não é um erro, é a sala piscando de
   * uma aparência para outra na frente de quem abriu.
   */
  const [prefs, setPrefs] = useState<Preferencias>(PREFERENCIAS_PADRAO);
  const malha = useRef<Malha | null>(null);

  /**
   * As ferramentas moram ao lado da malha, não dentro dela.
   *
   * O estado da malha é redesenhado a cada mudança — e o quadro muda dezenas
   * de vezes por segundo enquanto alguém desenha. Fundir os dois faria a
   * grade de vídeos e a lista de participantes repintarem a cada movimento
   * do lápis, com a chamada em cima.
   */
  const ferr = useRef<Ferramentas | null>(null);
  const [estadoF, setEstadoF] = useState<EstadoFerramentas | null>(null);
  const [ferrAberta, setFerrAberta] = useState<IdFerramenta | null>(null);
  const [ferrVisivel, setFerrVisivel] = useState(false);
  /**
   * Cor e espessura vivem aqui, e não no quadro.
   *
   * Elas são escolhidas no painel da esquerda e usadas na tela do palco —
   * dois lugares distantes na árvore, e a única coisa que os dois precisam
   * dividir. Guardar isso dentro de um deles obrigaria o outro a adivinhar.
   */
  const [pincel, setPincel] = useState<Pincel>(PINCEL_PADRAO);

  useEffect(() => {
    setPrefs(lerPreferencias());
    /**
     * O chat nasce aberto na tela grande e fechado no telefone.
     *
     * Não dá para decidir isto no `useState`: o servidor renderiza sem saber
     * o tamanho da janela, e chegar a um valor diferente do que o navegador
     * acha quebra a hidratação — a sala piscaria de uma aparência para outra
     * na frente de quem abriu. No telefone ele é uma gaveta que cobre a
     * conversa inteira, e cobrir a chamada ao entrar nela seria estranho.
     */
    /**
     * Na tela grande as duas colunas nascem abertas; no telefone, fechadas.
     *
     * A lateral virou mobília, e mobília aparece sozinha — quem entra numa
     * sala tem de ver o que ela oferece sem descobrir um botão antes. No
     * telefone as duas viram gaveta em cima da conversa, e abrir uma gaveta
     * por cima da chamada no instante de entrar nela seria estranho.
     */
    const largo = window.innerWidth >= 1024;
    setChatAberto(largo);
    setFerrVisivel(largo);
  }, []);

  function ajustar(mudanca: Partial<Preferencias>) {
    setPrefs((antes) => {
      const depois = { ...antes, ...mudanca };
      guardarPreferencias(depois);
      return depois;
    });
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
    const fe = new Ferramentas(m, setEstadoF);
    ferr.current = fe;
    setEstadoF(fe.estado());
    void m.entrar(sala, guardado);
    // Sair de verdade ao fechar a aba: sem isto o participante fica de fantasma
    // na lista dos outros até a varredura do servidor derrubá-lo.
    const aoFechar = () => m.sair();
    window.addEventListener("pagehide", aoFechar);
    return () => {
      window.removeEventListener("pagehide", aoFechar);
      fe.encerrar();
      ferr.current = null;
      m.sair();
    };
  }, [sala]);

  /**
   * Quem eu sou, e quem mais está aqui.
   *
   * O identificador só existe depois do `bemvindo`, e é ele que dispara o
   * "cheguei" das ferramentas — o recado que faz os donos mandarem o retrato
   * do quadro e das notas. Sem isto, entrar numa conversa em andamento
   * mostraria uma folha em branco que todos os outros veem cheia.
   */
  useEffect(() => {
    if (estado.voceId && nome) ferr.current?.souEu(estado.voceId, nome);
  }, [estado.voceId, nome]);

  useEffect(() => {
    if (!estado.voceId) return;
    ferr.current?.sincronizar([estado.voceId, ...estado.participantes.map((p) => p.id)]);
  }, [estado.voceId, estado.participantes]);

  const compartilhando = useMemo(
    () => estado.participantes.filter((p) => p.tela && p.video),
    [estado.participantes],
  );

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
    /**
     * As preferências viram atributos na raiz, e o CSS decide o resto.
     *
     * É mais barato e mais seguro que estilo em linha espalhado pelos
     * componentes: um seletor que não casa deixa o padrão valendo, enquanto um
     * `style` calculado errado escreve uma medida inválida direto no elemento.
     * E `--escala` é uma variável só, herdada por tudo que mede em `em`.
     */
    <div
      className="nv nv-fundo nv-sala"
      data-tema={prefs.tema}
      data-fundo={prefs.fundo}
      data-densidade={prefs.densidade}
      data-cantos={prefs.cantos}
      data-movimento={prefs.movimento}
      data-avatares={prefs.avatares}
      style={{ "--escala": prefs.texto } as React.CSSProperties}
    >
      {/*
        * Três colunas, como no Discord — e pelo mesmo motivo que ele tem três.
        *
        * A barra lateral esquerda é a **identidade e o inventário** da sala:
        * onde você está, o que dá para fazer aqui, e quem é você. Ela é fixa
        * porque o que ela guarda não muda com a conversa — e porque uma
        * gaveta que aparece e some obriga a pessoa a lembrar onde as coisas
        * estavam.
        *
        * O meio é a conversa: um cabeçalho que diz em que sala você está, o
        * palco, e a pílula de controles boiando por cima dele. A pílula flutua
        * de propósito: uma barra fixa embaixo rouba uma faixa de altura do
        * vídeo o tempo todo, mesmo quando ninguém está mexendo em nada.
        *
        * A direita é o chat, que abre e fecha — a única das três que se pode
        * dispensar sem perder nada da chamada.
        */}
      <div className="nv-corpo">
        <Rail
          sala={sala}
          nome={nome}
          estado={estado}
          prefs={prefs}
          f={estadoF}
          motor={ferr.current}
          aberta={ferrAberta}
          onAbrir={setFerrAberta}
          pincel={pincel}
          onPincel={setPincel}
          quadroNoPalco={telaAberta === "quadro"}
          onAbrirQuadroNoPalco={() => setTelaAberta("quadro")}
          visivel={ferrVisivel}
          onFechar={() => setFerrVisivel(false)}
          onMudo={() => malha.current?.mudo(!estado.mudo)}
        />

        <main className="nv-palco">
          <CabecalhoCanal
            sala={sala}
            estado={estado}
            rail={ferrVisivel}
            pedidos={estadoF?.pedidos.length ?? 0}
            onRail={() => setFerrVisivel((v) => !v)}
            chat={chatAberto}
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

          {/* A pílula flutua **dentro desta caixa**, e não do palco inteiro.
              Ancorada no palco, ela caía por cima da tirinha de pessoas
              sempre que alguém compartilhava a tela — e a tirinha é
              justamente onde se olha para saber quem ainda está ali. */}
          <div className="nv-palco-area">
            <Palco
              compartilhando={compartilhando}
              minhaTela={estado.tela ? malha.current?.minhaTela ?? null : null}
              estado={estado}
              nome={nome}
              prefs={prefs}
              aberta={telaAberta}
              onAbrir={setTelaAberta}
              onVolume={(id, v) => malha.current?.definirVolumeDe(id, v)}
              ferramentas={estadoF}
              motor={ferr.current}
              pincel={pincel}
            />

            <Controles
              estado={estado}
              prefs={prefs}
              onMudo={() => malha.current?.mudo(!estado.mudo)}
              onTela={() => void malha.current?.alternarTela()}
              onQualidade={(q) => void malha.current?.definirQualidade(q)}
              onMicrofone={(id) => void malha.current?.definirMicrofone(id)}
              onPreferencia={ajustar}
            />
          </div>

          {/* A tirinha embaixo só existe quando o palco está ocupado por uma
              tela; sem ela, as pessoas **são** o palco. */}
          {telaAberta && (
            <Pessoas
              estado={estado}
              nome={nome}
              prefs={prefs}
              variante="faixa"
              onVolume={(id, v) => malha.current?.definirVolumeDe(id, v)}
            />
          )}
        </main>

        <Chat
          estado={estado}
          aberto={chatAberto}
          onFechar={() => setChatAberto(false)}
          onEnviar={(t) => malha.current?.enviarChat(t)}
          onImagem={(f, legenda) => void malha.current?.enviarImagem(f, legenda)}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------- barra lateral --

/**
 * A coluna da esquerda: onde você está, o que dá para fazer, e quem é você.
 *
 * É o desenho que o Discord acertou e que vale a pena copiar: a lateral não
 * é uma gaveta, é **mobília**. Ela guarda três coisas que não mudam com o
 * andamento da conversa, e por isso podem morar num lugar fixo — o nome da
 * sala e o convite no alto, a lista do que a sala oferece no meio, e o seu
 * próprio cartão embaixo.
 *
 * O que ela **não** faz é ocupar o palco. Uma ferramenta aberta troca o
 * conteúdo desta coluna, e não o do meio: quem abre o quadro quer desenhar
 * enquanto conversa, e não em vez de conversar. Só a tela do quadro sobe ao
 * palco, como uma aba ao lado das telas compartilhadas.
 */
function Rail({
  sala,
  nome,
  estado,
  prefs,
  f,
  motor,
  aberta,
  onAbrir,
  pincel,
  onPincel,
  quadroNoPalco,
  onAbrirQuadroNoPalco,
  visivel,
  onFechar,
  onMudo,
}: {
  sala: string;
  nome: string;
  estado: EstadoMalha;
  prefs: Preferencias;
  f: EstadoFerramentas | null;
  motor: Ferramentas | null;
  aberta: IdFerramenta | null;
  onAbrir: (id: IdFerramenta | null) => void;
  pincel: Pincel;
  onPincel: (p: Pincel) => void;
  quadroNoPalco: boolean;
  onAbrirQuadroNoPalco: () => void;
  visivel: boolean;
  onFechar: () => void;
  onMudo: () => void;
}) {
  return (
    <nav className={`nv-rail${visivel ? " aberta" : ""}`} aria-label="A sala">
      <CabecalhoSala sala={sala} />

      <div className="nv-rail-corpo">
        {f && (
          <PainelFerramentas
            motor={motor}
            f={f}
            aberta={aberta}
            eu={estado.voceId}
            pincel={pincel}
            onPincel={onPincel}
            quadroNoPalco={quadroNoPalco}
            onAbrirQuadroNoPalco={onAbrirQuadroNoPalco}
            onAbrir={onAbrir}
            onFechar={onFechar}
          />
        )}
      </div>

      <CartaoEu nome={nome} estado={estado} prefs={prefs} onMudo={onMudo} />
    </nav>
  );
}

/**
 * O alto da lateral: a marca, o nome da sala, e o convite.
 *
 * O código e o convite são **uma peça só**. Eram dois — uma pílula com o
 * código, que não fazia nada, e um botão "copiar convite" ao lado. Quem quer
 * o código quer mandá-lo para alguém; ler em voz alta é o caminho raro.
 * Juntando, o alvo fica maior e a ação principal passa a ser a coisa mais
 * óbvia do canto.
 */
function CabecalhoSala({ sala }: { sala: string }) {
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
    <header className="nv-rail-topo">
      <Link href={comBase("/")} className="marca">
        NV<b>DISC</b>
      </Link>
      <button
        className={`nv-convite${copiado ? " copiado" : ""}`}
        onClick={copiar}
        title="copiar o link desta sala"
      >
        <span className="codigo">{sala}</span>
        <span className="acao">{copiado ? "copiado ✓" : "copiar convite"}</span>
      </button>
    </header>
  );
}

/**
 * O seu cartão, no pé da lateral.
 *
 * O microfone aparece **duas vezes** na sala de propósito: aqui e na pílula
 * do palco. Não é descuido — é a mesma decisão do Discord, e ela é sobre
 * confiança, não sobre atalho. O botão da pílula é o comando; este aqui é o
 * **estado**, no lugar onde está escrito o seu nome. Quem passa a chamada
 * inteira em dúvida sobre se está mudo olha para o próprio nome, não para
 * uma barra de ferramentas que pode ter sumido atrás de um menu.
 */
function CartaoEu({
  nome,
  estado,
  prefs,
  onMudo,
}: {
  nome: string;
  estado: EstadoMalha;
  prefs: Preferencias;
  onMudo: () => void;
}) {
  const cor = useMemo(() => corDaPessoa(nome), [nome]);
  const colorido = prefs.avatares === "cor";
  const falando = estado.meuVolume > 0.06 && !estado.mudo;

  return (
    <footer className={`nv-eu${falando ? " falando" : ""}`}>
      <span
        className="nv-avatar"
        style={colorido ? { background: cor.fundo } : undefined}
      >
        {nome.slice(0, 1).toUpperCase()}
        {falando && (
          <span
            aria-hidden
            className="nv-anel"
            style={{
              transform: `scale(${1 + estado.meuVolume * 0.3})`,
              ...(colorido ? { borderColor: cor.anel } : {}),
            }}
          />
        )}
      </span>

      <span className="nv-eu-texto">
        <b>{nome}</b>
        {/* O estado da conexão com o servidor mora aqui e não no topo do
            palco: é sobre **você**, e não sobre a conversa. */}
        <em className={estado.ligado ? "" : "caiu"}>
          {estado.ligado
            ? estado.mudo
              ? "microfone desligado"
              : "na sala"
            : "reconectando…"}
        </em>
      </span>

      <button
        className={`nv-eu-botao${estado.mudo ? " perigo" : ""}`}
        onClick={onMudo}
        title={estado.mudo ? "ligar o microfone (M)" : "desligar o microfone (M)"}
        aria-label={estado.mudo ? "ligar o microfone" : "desligar o microfone"}
      >
        {estado.mudo ? <MicOffIcon size={16} /> : <MicIcon size={16} />}
      </button>
    </footer>
  );
}

// ------------------------------------------------ o cabeçalho do palco --

/**
 * A barra do alto do palco — o "# canal" do Discord.
 *
 * Ela responde a uma pergunta só, e a responde sem que se peça: **em que
 * sala eu estou, e com quantas pessoas**. É o que a barra de título de uma
 * chamada precisa dizer; o resto (convite, ajustes, o seu microfone) tem
 * lugar próprio e não disputa espaço aqui.
 *
 * À direita ficam as duas gavetas — as ferramentas e o chat —, porque abrir
 * e fechar coluna é ação de moldura, não de chamada. Elas saíram da pílula
 * de controles justamente por isso: a pílula é o que você faz **na conversa**
 * (falar, mostrar a tela, sair), e misturar as duas coisas fazia uma fileira
 * de sete botões onde nenhum se destacava.
 */
function CabecalhoCanal({
  sala,
  estado,
  rail,
  pedidos,
  onRail,
  chat,
  naoLidas,
  onChat,
}: {
  sala: string;
  estado: EstadoMalha;
  rail: boolean;
  pedidos: number;
  onRail: () => void;
  chat: boolean;
  naoLidas: number;
  onChat: () => void;
}) {
  const quantos = estado.participantes.length + 1;

  return (
    <header className="nv-canal">
      <button
        className={`nv-canal-botao so-estreito${rail ? " ligado" : ""}`}
        onClick={onRail}
        title="ferramentas da sala"
        aria-label="Ferramentas da sala"
      >
        <FerramentasIcon size={16} />
        {pedidos > 0 && <span className="nv-distintivo">{pedidos}</span>}
      </button>

      <h1 className="nv-canal-nome">
        <span aria-hidden>#</span>
        {sala}
      </h1>

      <span className={`nv-canal-gente${estado.ligado ? "" : " caiu"}`}>
        <span className={`nv-ponto${estado.ligado ? "" : " off"}`} aria-hidden />
        {estado.ligado ? `${quantos} na sala` : "reconectando…"}
      </span>

      <div className="nv-canal-acoes">
        <button
          className={`nv-canal-botao so-largo${rail ? " ligado" : ""}`}
          onClick={onRail}
          title="ferramentas da sala"
          aria-label="Ferramentas da sala"
        >
          <FerramentasIcon size={16} />
          {pedidos > 0 && <span className="nv-distintivo">{pedidos}</span>}
        </button>
        <button
          className={`nv-canal-botao${chat ? " ligado" : ""}`}
          onClick={onChat}
          title="chat da sala"
          aria-label="Chat da sala"
        >
          <ChatIcon size={16} />
          {naoLidas > 0 && !chat && (
            <span className="nv-distintivo">{naoLidas > 9 ? "9+" : naoLidas}</span>
          )}
        </button>
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
function Som({
  fluxo,
  nome,
  volume = 1,
}: {
  fluxo: MediaStream;
  nome: string;
  volume?: number;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const reforco = useRef<ReturnType<typeof criarReforco> | null>(null);

  /**
   * Dois caminhos, e a escolha é pelo valor.
   *
   * Até 100% o elemento resolve sozinho, sem depender do motor de áudio — que
   * é o caminho mais robusto e o que vale para quase todo mundo. Acima de
   * 100% não há como pedir mais ao elemento, e aí o fluxo passa pelo reforço.
   * Só quem pede o extra paga o risco do extra.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (volume > 1) {
      el.muted = true;
      if (!reforco.current) reforco.current = criarReforco(fluxo);
      reforco.current.ajustar(volume);
    } else {
      reforco.current?.parar();
      reforco.current = null;
      el.muted = false;
      el.volume = volume;
    }
  }, [fluxo, volume]);

  useEffect(
    () => () => {
      reforco.current?.parar();
      reforco.current = null;
    },
    [],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = fluxo;
    let vivo = true;

    // O navegador pode recusar tocar sozinho: a permissão de reprodução
    // automática se perde na navegação entre a entrada e a sala. Recusa não é
    // erro — é um caso a tratar.
    const tocar = () => {
      el.play().then(
        () => vivo && setBloqueado(false),
        () => vivo && setBloqueado(true),
      );
    };
    tocar();

    /**
     * Qualquer gesto na página tenta de novo.
     *
     * O botão "ouvir fulano" continua ali como último recurso, e ele sozinho
     * não bastava: são tantos botões quantas pessoas na sala, cada um
     * liberando uma voz só. Quem clicasse em dois e parasse — que é o que
     * qualquer pessoa faz — ficaria sem ouvir o resto e sem entender por quê.
     * Registrado aqui, o primeiro clique em qualquer canto solta a sala
     * inteira, junto com o motor de áudio.
     */
    const soltar = aoPrimeiroGesto(tocar);

    /**
     * E uma última rede: um `<audio>` pode parar depois de já estar tocando.
     * Acontece quando o aparelho de saída troca no meio (fone que sai da
     * base, HDMI que desliga) — o elemento pausa e não avisa ninguém. Uma
     * conferência a cada três segundos é barata e fecha esse buraco.
     */
    const conferir = setInterval(() => {
      if (el.paused && el.srcObject) tocar();
    }, 3000);

    return () => {
      vivo = false;
      soltar();
      clearInterval(conferir);
    };
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

/**
 * Uma aba do palco.
 *
 * Duas espécies com a mesma cara: a tela que alguém compartilha (um fluxo de
 * vídeo) e o quadro (um desenho que a sala faz junto). Elas dividem o cartão,
 * a prévia e o lugar porque, para quem usa, são a mesma coisa — algo que
 * ocupa o meio da tela e que todo mundo olha ao mesmo tempo.
 */
type Aba = {
  id: string;
  quem: string;
  tipo: "video" | "quadro";
  fluxo?: MediaStream;
  som: boolean | null;
};

/**
 * O palco e a área de telas.
 *
 * A área de telas **existe sempre**, mesmo vazia. Antes ela só aparecia quando
 * alguém já estava compartilhando, e o efeito era que ninguém sabia que a sala
 * tinha esse lugar: a tela do outro surgia do nada no meio da conversa, e
 * quando havia duas, descobrir que dava para trocar era acidente. Um lugar
 * fixo, mesmo vazio, ensina onde olhar antes de haver o que ver.
 */
function Palco({
  compartilhando,
  minhaTela,
  estado,
  nome,
  prefs,
  aberta,
  onAbrir,
  onVolume,
  ferramentas,
  motor,
  pincel,
}: {
  compartilhando: Participante[];
  minhaTela: MediaStream | null;
  estado: EstadoMalha;
  nome: string;
  prefs: Preferencias;
  aberta: string | null;
  onAbrir: (id: string | null) => void;
  onVolume: (id: string, v: number) => void;
  ferramentas: EstadoFerramentas | null;
  motor: Ferramentas | null;
  pincel: Pincel;
}) {
  /**
   * As telas que existem agora, em ordem estável.
   *
   * A sua vem primeiro porque é a que você confere ("estou mostrando o que
   * queria mostrar?"), e não porque seja a mais importante para quem assiste.
   */
  const telas: Aba[] = [
    /**
     * O quadro é a primeira aba, e existe sempre.
     *
     * Sempre, mesmo em branco e mesmo sem dono — pelo mesmo motivo que a área
     * de telas existe vazia: um lugar fixo ensina onde olhar antes de haver o
     * que ver. Um quadro que só aparecesse depois de alguém desenhar seria um
     * quadro que ninguém descobre, porque para desenhar é preciso achá-lo
     * primeiro.
     */
    { id: "quadro", quem: "Quadro", tipo: "quadro", som: null },
    ...(minhaTela
      ? [{ id: "eu", quem: "você", tipo: "video" as const, fluxo: minhaTela, som: estado.telaComSom }]
      : []),
    ...compartilhando.map((p) => ({
      id: p.id,
      quem: p.nome,
      tipo: "video" as const,
      fluxo: p.video!,
      som: null as boolean | null,
    })),
  ];

  // Quem estava sendo assistido pode ter parado de compartilhar. Cair para
  // "nenhuma" em vez de pular para outra tela: trocar o que a pessoa está
  // olhando sem ela pedir é pior que mostrar a sala de volta.
  const atual = telas.find((t) => t.id === aberta) ?? null;

  const chegando = estado.participantes.find((p) => p.tela && !p.video);

  return (
    <>
      <AreaDeTelas
        telas={telas}
        atual={atual?.id ?? null}
        chegando={chegando?.nome ?? null}
        tracos={ferramentas?.quadro.tracos ?? []}
        onAbrir={onAbrir}
      />

      {atual ? (
        <div className="nv-telas uma">
          {atual.tipo === "quadro" && ferramentas ? (
            <QuadroPalco
              f={ferramentas}
              motor={motor}
              eu={estado.voceId}
              pincel={pincel}
              onFechar={() => onAbrir(null)}
            />
          ) : atual.fluxo ? (
            <Tela fluxo={atual.fluxo} legenda={atual.quem} onFechar={() => onAbrir(null)} />
          ) : null}
        </div>
      ) : (
        // **Sem tela aberta, quem ocupa o palco são as pessoas.**
        //
        // Numa chamada de voz — que é o caso comum — ninguém está mostrando
        // nada, e deixar o meio da tela vazio enquanto os participantes se
        // espremem numa faixa de 60 px embaixo é desperdiçar a tela inteira
        // para dizer que não há nada nela.
        <Pessoas
          estado={estado}
          nome={nome}
          prefs={prefs}
          variante="grade"
          onVolume={onVolume}
        />
      )}
    </>
  );
}

/**
 * A área das telas compartilhadas.
 *
 * Cada tela é um cartão com prévia ao vivo — e a prévia é o ponto. Uma lista
 * de nomes obriga a abrir para descobrir o que é; com a miniatura, "a tela do
 * Fulano" deixa de ser um rótulo e passa a ser a coisa.
 */
function AreaDeTelas({
  telas,
  atual,
  chegando,
  tracos,
  onAbrir,
}: {
  telas: Aba[];
  atual: string | null;
  chegando: string | null;
  tracos: Traco[];
  onAbrir: (id: string | null) => void;
}) {
  /** As telas de gente — o quadro é fixo e não conta para "quantas". */
  const compartilhadas = telas.filter((t) => t.tipo === "video").length;
  return (
    /**
      * Vazia, a área inteira cabe numa linha.
      *
      * Ela tinha um cabeçalho e um parágrafo de duas linhas explicando que não
      * havia nada — uma faixa da largura da tela para anunciar um vazio, todo
      * santo dia, para quem já sabe. O lugar fixo continua ensinando onde
      * olhar; só parou de cobrar 80 px por isso.
      */
    /**
     * Uma linha só: rótulo, abas, e a saída.
     *
     * Antes eram duas — um cabeçalho em cima e os cartões embaixo —, e as
     * duas juntas cobravam 145 px de altura do palco o tempo inteiro. Com o
     * quadro sempre presente isto deixou de ser "uma área que às vezes tem
     * coisa" e virou o que sempre foi na prática: uma barra de abas. Barra de
     * abas tem uma linha.
     */
    <section className="nv-area-telas" aria-label="Telas e quadro">
      <span className="nv-eyebrow">No palco</span>

      <ul>
        {telas.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className={`nv-cartao-tela${t.id === atual ? " ativa" : ""}${
                t.tipo === "quadro" ? " quadro" : ""
              }`}
              onClick={() => onAbrir(t.id === atual ? null : t.id)}
              aria-current={t.id === atual ? "true" : undefined}
              title={
                t.id === atual
                  ? "voltar às pessoas"
                  : t.tipo === "quadro"
                    ? "abrir o quadro"
                    : `assistir a tela de ${t.quem}`
              }
            >
              {t.tipo === "quadro" ? (
                <MiniaturaQuadro tracos={tracos} />
              ) : (
                <Miniatura fluxo={t.fluxo!} />
              )}
              <span className="nome">
                {t.tipo === "quadro" ? <QuadroIcon size={12} /> : <TelaIcon size={12} />}
                {t.quem}
              </span>
              {/* Só a própria captura sabe dizer se veio com som; a dos
                  outros chega pronta e não há como perguntar. */}
              {t.som === false && <span className="nv-sem-som">sem som</span>}
            </button>
          </li>
        ))}
      </ul>

      {compartilhadas === 0 && (
        <span className="nv-nota nv-telas-vazio">
          {chegando
            ? `${chegando} começou a compartilhar; a imagem aparece aqui em instantes.`
            : "ninguém está compartilhando a tela"}
        </span>
      )}

      {atual && (
        <button className="nv-mini nv-abas-sair" onClick={() => onAbrir(null)}>
          voltar às pessoas
        </button>
      )}
    </section>
  );
}

/** A prévia dentro do cartão. Muda, sempre: o som sai pelo `<Som>` da pessoa. */
function Miniatura({ fluxo }: { fluxo: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = fluxo;
  }, [fluxo]);
  return <video ref={ref} autoPlay playsInline muted aria-hidden />;
}

function Tela({
  fluxo,
  legenda,
  onFechar,
}: {
  fluxo: MediaStream;
  legenda: string;
  onFechar: () => void;
}) {
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
      <div className="nv-tela-botoes">
        <button
          type="button"
          onClick={ampliar}
          title="abrir em tela cheia (ou dê dois cliques na tela)"
          aria-label="abrir em tela cheia"
        >
          <ExpandirIcon size={15} />
        </button>
        <button type="button" onClick={onFechar} title="fechar esta tela" aria-label="fechar esta tela">
          <FecharIcon size={15} />
        </button>
      </div>
    </figure>
  );
}

// ------------------------------------------------------------- pessoas --

function Pessoas({
  estado,
  nome,
  prefs,
  variante,
  onVolume,
}: {
  estado: EstadoMalha;
  nome: string;
  prefs: Preferencias;
  variante: "grade" | "faixa";
  onVolume: (id: string, v: number) => void;
}) {
  const grade = variante === "grade";
  const gente = (
    <>
      <Pessoa
        nome={nome}
        volume={estado.meuVolume}
        nivel={prefs.medidor ? estado.meuNivel : undefined}
        mudo={estado.mudo}
        tela={estado.tela}
        grande={grade}
        colorido={prefs.avatares === "cor"}
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
          colorido={prefs.avatares === "cor"}
          saida={estado.volumes[p.id] ?? 1}
          onSaida={(v) => onVolume(p.id, v)}
        />
      ))}
    </>
  );

  /**
   * Quanta gente há, para o CSS poder dimensionar os cartões.
   *
   * Cartão de tamanho fixo deixa três pessoas boiando no meio de uma tela de
   * 1440 px e espreme oito na mesma largura. Com o número aqui, a largura vira
   * uma conta: divide o espaço, com um piso e um teto para não virar selo nem
   * outdoor.
   */
  const quantos = estado.participantes.length + 1;

  if (!grade) {
    return (
      <section className="nv-pessoas-faixa">
        <ul className="nv-gente faixa">{gente}</ul>
      </section>
    );
  }

  return (
    <section className="nv-pessoas-grade">
      <ul className="nv-gente" style={{ "--n": quantos } as React.CSSProperties}>
        {gente}
      </ul>
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

/**
 * O sinal amarelo, em português.
 *
 * Ele mostrava o `connectionState` cru — `connecting`, `disconnected`,
 * `failed` —, três palavras em inglês que dizem ao usuário exatamente nada.
 * Pior: as três apareciam com a mesma cara de alarme, e uma delas
 * (`connecting`) é o estado **normal** dos primeiros segundos de qualquer
 * pessoa que entra. Quem via o triângulo amarelo aceso não tinha como saber
 * se devia esperar, recarregar, ou avisar a outra pessoa.
 *
 * Agora são dois tons: `esperando` é a sala trabalhando, e gira em vez de
 * alarmar; `alerta` é a sala já tendo tentado. O texto diz o que está
 * acontecendo e, quando há, o que a sala vai fazer sozinha a respeito — a
 * escada do vigia em `malha.ts` está por trás de cada uma destas frases.
 */
function diagnostico(
  conexao: Participante["conexao"] | undefined,
): { tom: "esperando" | "alerta"; porque: string } | null {
  switch (conexao) {
    case "aguardando":
    case "new":
      return { tom: "esperando", porque: "chegando na sala — abrindo a conexão de voz" };
    case "connecting":
      return {
        tom: "esperando",
        porque:
          "procurando caminho de rede até esta pessoa. Se demorar, a sala tenta " +
          "outro caminho sozinha, e avisa aqui no chat se não achar nenhum.",
      };
    case "disconnected":
      return {
        tom: "alerta",
        porque: "a conexão com esta pessoa caiu no meio — a sala está refazendo",
      };
    case "failed":
      return {
        tom: "alerta",
        porque:
          "não há caminho de rede entre vocês dois. A sala já tentou de novo; " +
          "este é o caso que precisa de um servidor TURN.",
      };
    case "closed":
      return { tom: "alerta", porque: "esta conexão foi encerrada" };
    default:
      return null;
  }
}

function Pessoa({
  nome,
  volume,
  nivel,
  mudo,
  tela,
  eu,
  conexao,
  fluxo,
  grande,
  colorido,
  saida = 1,
  onSaida,
}: {
  nome: string;
  volume: number;
  /** o nível cru, para a régua de quem pediu para vê-la; ausente = sem régua */
  nivel?: number;
  mudo: boolean;
  tela: boolean;
  eu?: boolean;
  conexao?: Participante["conexao"];
  fluxo?: MediaStream;
  grande?: boolean;
  colorido?: boolean;
  /** o volume com que **eu** ouço esta pessoa: 0 a 2 */
  saida?: number;
  onSaida?: (v: number) => void;
}) {
  const [menu, setMenu] = useState(false);
  const caixa = useRef<HTMLLIElement>(null);
  const falando = volume > 0.06 && !mudo;

  /**
   * Fechar ao clicar fora, e no Esc.
   *
   * `pointerdown` e não `click`: o `click` só dispara ao soltar, e quem
   * arrasta o deslizante de volume para fora do menu soltaria o botão fora
   * dele — fechando o menu no meio do ajuste.
   */
  useEffect(() => {
    if (!menu) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setMenu(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("pointerdown", fora);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("keydown", tecla);
    };
  }, [menu]);
  // Só o que der problema aparece. Um selo "conectado" em cada pessoa o tempo
  // todo é ruído — o silêncio já quer dizer que está tudo bem.
  const problema = diagnostico(conexao);

  const ajustavel = !eu && !!onSaida;
  const cor = useMemo(() => corDaPessoa(nome), [nome]);

  return (
    <li
      ref={caixa}
      className={`nv-pessoa${grande ? " grande" : ""}${falando ? " falando" : ""}${
        ajustavel ? " ajustavel" : ""
      }`}
      onClick={ajustavel ? () => setMenu((v) => !v) : undefined}
      title={ajustavel ? "clique para ajustar o volume desta pessoa" : undefined}
    >
      {/**
        * A cor sai do nome, e por isso é a mesma em todos os navegadores sem
        * passar pela sinalização. Com os avatares em `neutro`, o `style` não
        * é escrito e o CSS volta ao gradiente da marca — nenhum dos dois
        * caminhos depende do outro estar certo.
        */}
      <span
        className="nv-avatar"
        style={colorido ? { background: cor.fundo } : undefined}
      >
        {nome.slice(0, 1).toUpperCase()}
        {falando && (
          <span
            aria-hidden
            className="nv-anel"
            style={{
              transform: `scale(${1 + volume * 0.3})`,
              ...(colorido ? { borderColor: cor.anel } : {}),
            }}
          />
        )}
      </span>

      <span className="nv-nome">
        {nome}
        {eu && <span>(você)</span>}
      </span>

      {/* A régua só existe para quem pediu para vê-la, e só no próprio
          cartão: o nível cru de outra pessoa não é medido aqui. */}
      {nivel !== undefined && (
        <span className="nv-regua" aria-hidden>
          <span style={{ width: `${Math.min(100, nivel * 320)}%` }} />
        </span>
      )}

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
          <span
            className={`nv-diag ${problema.tom}`}
            title={problema.porque}
            aria-label={problema.porque}
          >
            {problema.tom === "esperando" ? (
              <i className="nv-girando" aria-hidden />
            ) : (
              <AlertaIcon size={14} />
            )}
          </span>
        )}
        {/* Só aparece quando saiu do normal: um ícone de volume em todo mundo
            o tempo todo é ruído, e o silêncio já quer dizer "100%". */}
        {ajustavel && saida !== 1 && (
          <span
            style={{ color: saida === 0 ? "var(--erro)" : "var(--accent-light)" }}
            title={saida === 0 ? "silenciada para você" : `volume em ${Math.round(saida * 100)}%`}
          >
            <VolumeIcon size={14} />
          </span>
        )}
      </span>

      {menu && onSaida && (
        <MenuVolume nome={nome} valor={saida} onMudar={onSaida} />
      )}

      {/* o alto-falante desta pessoa; sem ele a sala é muda */}
      {fluxo && !eu && <Som fluxo={fluxo} nome={nome} volume={saida} />}
    </li>
  );
}

/**
 * O volume de uma pessoa, só para quem ajusta.
 *
 * Não é moderação: nada é dito à sala e a outra pessoa não fica sabendo. É
 * para o caso comum de alguém entrar com o microfone alto demais ou baixo
 * demais e não ter como resolver do lado dela.
 *
 * Vai até 200% porque abaixar é fácil (o elemento de áudio faz) e **subir** é
 * a metade que ninguém oferece — e é justamente a que resolve o participante
 * de notebook velho que ninguém escuta.
 */
function MenuVolume({
  nome,
  valor,
  onMudar,
}: {
  nome: string;
  valor: number;
  onMudar: (v: number) => void;
}) {
  const passo = (d: number) => onMudar(Math.min(2, Math.max(0, Math.round((valor + d) * 20) / 20)));

  return (
    // O clique não pode subir para o `<li>`, que alterna o menu — sem isto,
    // mexer no deslizante fecharia o menu.
    <div className="nv-menu-volume" onClick={(e) => e.stopPropagation()}>
      <span className="nv-eyebrow">{nome}</span>

      <div className="nv-menu-linha">
        <button onClick={() => passo(-0.1)} aria-label="diminuir">
          −
        </button>
        <output>{Math.round(valor * 100)}%</output>
        <button onClick={() => passo(0.1)} aria-label="aumentar">
          +
        </button>
      </div>

      <input
        type="range"
        className="nv-range"
        min={0}
        max={2}
        step={0.05}
        value={valor}
        onChange={(e) => onMudar(Number(e.target.value))}
        aria-label={`volume de ${nome}`}
      />

      <div className="nv-menu-acoes">
        <button
          className={`nv-mini${valor === 0 ? " ativo" : ""}`}
          onClick={() => onMudar(valor === 0 ? 1 : 0)}
        >
          {valor === 0 ? "ouvir de novo" : "silenciar para mim"}
        </button>
        {valor !== 1 && (
          <button className="nv-mini" onClick={() => onMudar(1)}>
            normal
          </button>
        )}
      </div>

      {valor > 1 && (
        <p className="nv-nota">
          Acima de 100% o som passa por um reforço. Se distorcer, é o microfone
          da outra pessoa estourando — baixe um pouco.
        </p>
      )}
    </div>
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
        <button onClick={onFechar} aria-label="fechar o chat">
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

/**
 * A pílula de controles, boiando no pé do palco.
 *
 * Ela encolheu de sete botões para quatro, e isso é o conserto principal.
 * Antes era uma barra fixa com tudo dentro — microfone, tela, ferramentas,
 * chat, ajustes e sair —, todos do mesmo tamanho, todos com rótulo, e por
 * isso nenhum encontrável de relance. Numa chamada de verdade, três desses
 * botões nunca são apertados com pressa, e dois nem são sobre a chamada:
 * abrir e fechar coluna é moldura, e foi para a moldura (o cabeçalho do
 * palco).
 *
 * O que ficou é o que se aperta com pressa: **fala**, **mostra a tela**,
 * **ajusta**, **sai**. Redondos e sem rótulo, como o Discord faz, porque
 * quatro ícones grandes se acham no canto do olho e seis palavras não.
 * O rótulo virou `title` e `aria-label`: quem precisa de nome, tem nome.
 *
 * E ela **flutua** por cima do palco em vez de ocupar uma faixa fixa: uma
 * barra sólida embaixo cobra altura de vídeo o tempo todo, inclusive nos
 * cinquenta minutos em que ninguém encosta nela.
 */
function Controles({
  estado,
  prefs,
  onMudo,
  onTela,
  onQualidade,
  onMicrofone,
  onPreferencia,
}: {
  estado: EstadoMalha;
  prefs: Preferencias;
  onMudo: () => void;
  onTela: () => void;
  onQualidade: (q: Partial<Qualidade>) => void;
  onMicrofone: (id: string | null) => void;
  onPreferencia: (p: Partial<Preferencias>) => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <footer className="nv-controles">
      {aberto && (
        <PainelQualidade
          q={estado.qualidade}
          estado={estado}
          prefs={prefs}
          microfones={estado.microfones}
          microfoneId={estado.microfoneId}
          onQualidade={onQualidade}
          onMicrofone={onMicrofone}
          onPreferencia={onPreferencia}
          onFechar={() => setAberto(false)}
        />
      )}

      <div className="nv-pilula">
        <button
          className={`nv-redondo${estado.mudo ? " perigo" : ""}`}
          onClick={onMudo}
          title={estado.mudo ? "ligar o microfone (M)" : "desligar o microfone (M)"}
          aria-label={estado.mudo ? "ligar o microfone" : "desligar o microfone"}
          aria-pressed={estado.mudo}
        >
          {estado.mudo ? <MicOffIcon /> : <MicIcon />}
        </button>

        <button
          className={`nv-redondo${estado.tela ? " ligado" : ""}`}
          onClick={onTela}
          title={estado.tela ? "parar de compartilhar a tela" : "compartilhar a tela"}
          aria-label={estado.tela ? "parar de compartilhar a tela" : "compartilhar a tela"}
          aria-pressed={estado.tela}
        >
          {estado.tela ? <PararIcon /> : <TelaIcon />}
        </button>

        <button
          className={`nv-redondo${aberto ? " ligado" : ""}`}
          onClick={() => setAberto((v) => !v)}
          title="ajustes de som, vídeo e aparência"
          aria-label="Ajustes"
          aria-pressed={aberto}
        >
          <AjustesIcon />
        </button>

        {/* O de sair é o único vermelho por padrão, e fica separado dos
            outros por uma divisória: ele é o botão que ninguém quer apertar
            por engano no meio de uma conversa. */}
        <Link
          href={comBase("/")}
          className="nv-redondo desligar"
          title="sair da sala"
          aria-label="Sair da sala"
        >
          <SairIcon />
        </Link>
      </div>
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
  prefs,
  microfones,
  microfoneId,
  onQualidade,
  onMicrofone,
  onPreferencia,
  onFechar,
}: {
  q: Qualidade;
  estado: EstadoMalha;
  prefs: Preferencias;
  microfones: { id: string; nome: string }[];
  microfoneId: string | null;
  onQualidade: (q: Partial<Qualidade>) => void;
  onMicrofone: (id: string | null) => void;
  onPreferencia: (p: Partial<Preferencias>) => void;
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
      {aba === "tema" && <AbaTema prefs={prefs} onPreferencia={onPreferencia} />}
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
 * A aba de personalização.
 *
 * Tudo aqui vale **só para quem mexe**, e a nota no rodapé diz isso — sem ela
 * a primeira pergunta de qualquer um é se o outro lado está vendo a mesma
 * coisa, e a segunda é se dá para mudar a sala dos outros.
 *
 * O que **não** está aqui, de propósito: contraste e superfícies. A
 * legibilidade foi medida uma vez (16.8:1 no texto principal) e não é assunto
 * de gosto — trocar contraste por preferência é como se produz uma interface
 * bonita que ninguém consegue ler por uma hora seguida.
 */
function AbaTema({
  prefs,
  onPreferencia,
}: {
  prefs: Preferencias;
  onPreferencia: (p: Partial<Preferencias>) => void;
}) {
  return (
    <>
      <div className="grupo">
        <span className="nv-rotulo">Cor de acento</span>
        <div className="nv-temas">
          {TEMAS.map((t) => (
            <button
              key={t.v}
              className={`nv-tema${prefs.tema === t.v ? " ativo" : ""}`}
              onClick={() => onPreferencia({ tema: t.v })}
              aria-pressed={prefs.tema === t.v}
              title={t.r}
            >
              <span style={{ background: t.cor }} aria-hidden />
              {t.r}
            </button>
          ))}
        </div>
      </div>

      <div className="grupo">
        <Escolha
          titulo="Fundo"
          valor={prefs.fundo}
          opcoes={[
            { v: "grade", r: "Grade" },
            { v: "brilho", r: "Brilho" },
            { v: "liso", r: "Liso" },
          ]}
          onEscolher={(v) => onPreferencia({ fundo: v as Preferencias["fundo"] })}
        />
        <p className="nv-nota">
          {prefs.fundo === "grade"
            ? "A malha e os dois brilhos da central — o mesmo fundo do resto do site."
            : prefs.fundo === "brilho"
              ? "Só a luz, sem a malha. Menos textura competindo com uma tela compartilhada."
              : "Quase-preto puro. É o que menos disputa atenção numa chamada longa."}
        </p>
      </div>

      <div className="grupo">
        <Escolha
          titulo="Densidade"
          valor={prefs.densidade}
          opcoes={[
            { v: "compacto", r: "Compacto" },
            { v: "confortavel", r: "Confortável" },
            { v: "amplo", r: "Amplo" },
          ]}
          onEscolher={(v) => onPreferencia({ densidade: v as Preferencias["densidade"] })}
        />
        <p className="nv-nota">
          Quanto ar entre as coisas. No compacto cabe mais gente na tela sem
          rolar; no amplo, cada cartão respira.
        </p>
      </div>

      <div className="grupo">
        <Escolha
          titulo="Cantos"
          valor={prefs.cantos}
          opcoes={[
            { v: "reto", r: "Reto" },
            { v: "suave", r: "Suave" },
            { v: "redondo", r: "Redondo" },
          ]}
          onEscolher={(v) => onPreferencia({ cantos: v as Preferencias["cantos"] })}
        />
      </div>

      <div className="grupo">
        <Deslizante
          titulo="Tamanho do texto"
          valor={Math.round(prefs.texto * 100)}
          min={90}
          max={115}
          passo={5}
          formatar={(v) => `${v}%`}
          onMudar={(v) => onPreferencia({ texto: v / 100 })}
          nota="Vale para a sala inteira — nomes, chat e painéis crescem juntos."
        />
      </div>

      <div className="grupo">
        <Escolha
          titulo="Avatares"
          valor={prefs.avatares}
          opcoes={[
            { v: "cor", r: "Cor por pessoa" },
            { v: "neutro", r: "Cor da marca" },
          ]}
          onEscolher={(v) => onPreferencia({ avatares: v as Preferencias["avatares"] })}
        />
        <p className="nv-nota">
          A cor sai do nome, por uma conta que todo navegador faz igual — então
          todo mundo vê a mesma cor na mesma pessoa, hoje e amanhã. Quem quiser
          outra troca de nome.
        </p>
      </div>

      <div className="grupo">
        <Chave
          titulo="Régua do meu microfone"
          ligado={prefs.medidor}
          onMudar={(v) => onPreferencia({ medidor: v })}
          nota="Uma barra de nível no seu cartão, sempre visível. Responde de relance a pergunta que aparece toda vez que a sala fica quieta: eles não estão falando, ou eu que não estou sendo ouvido?"
        />
      </div>

      <div className="grupo">
        <Chave
          titulo="Movimento"
          ligado={prefs.movimento === "completo"}
          onMudar={(v) => onPreferencia({ movimento: v ? "completo" : "reduzido" })}
          nota="Desligado, as transições somem e o anel de fala para de crescer — fica só a mudança de cor. Se o seu sistema já pede menos movimento, isto já está valendo."
        />
      </div>

      <div className="rodape">
        <p className="nv-nota">
          Tudo desta aba vale{" "}
          <strong style={{ color: "var(--txt-2)" }}>só para você</strong>, neste
          navegador. A sala de quem está do outro lado não muda, e ninguém é
          avisado. Fica guardado entre visitas.
        </p>
        <button
          className="nv-mini"
          style={{ marginTop: 10 }}
          onClick={() => onPreferencia(PREFERENCIAS_PADRAO)}
        >
          voltar ao padrão
        </button>
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
