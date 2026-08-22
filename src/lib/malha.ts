/**
 * A malha — as conexões de áudio e tela entre os navegadores.
 *
 * Cada participante mantém uma conexão direta com **cada** um dos outros
 * (topologia em malha). A mídia não passa pelo servidor: ele só apresenta as
 * pessoas e entrega os recados da negociação.
 *
 * Por que malha, e não um servidor de mídia
 * ----------------------------------------
 * Um SFU (servidor que recebe de todos e redistribui) escala para dezenas de
 * pessoas, mas é mais um serviço para manter de pé, com CPU e banda de
 * verdade. Numa sala de amigos — o caso que este projeto atende — a malha ganha
 * em tudo o que importa: menor latência (o som vai direto), custo de servidor
 * quase nulo, e ninguém no meio do caminho ouvindo. O preço é o número de
 * conexões crescer ao quadrado, e é por isso que existe um teto de oito
 * pessoas por sala.
 *
 * As duas coisas que fazem malha funcionar
 * ---------------------------------------
 * **1. Negociação perfeita.** Quando os dois lados resolvem propor mudança ao
 * mesmo tempo, a negociação trava — é o *glare*. A solução do padrão é dar a
 * um dos lados o papel de "educado": ele cede e refaz. O papel sai da
 * comparação dos dois identificadores, que é a mesma conta nos dois
 * navegadores e sempre dá papéis opostos, sem ninguém combinar nada.
 *
 * **2. Transceptor de vídeo criado desde o começo.** A tela é compartilhada
 * trocando a faixa de um transceptor que já existe (`replaceTrack`), e não
 * acrescentando uma faixa nova. Acrescentar faixa obriga a renegociar a
 * conexão com todo mundo — e renegociar com cinco pessoas ao mesmo tempo, cada
 * uma podendo estar renegociando também, é exatamente onde a malha costuma
 * quebrar. Com o transceptor pronto desde o início, ligar e desligar a tela
 * não renegocia nada: troca-se a faixa e pronto.
 */

import { PARA_CLIENTE, PARA_SERVIDOR, limparSessao } from "./protocolo.mjs";
import { CAMINHO_SINAL } from "./base.mjs";
import { configuracaoDoNavegador, criarSinalSupabase } from "./sinal-supabase";

export type Participante = {
  id: string;
  nome: string;
  mudo: boolean;
  tela: boolean;
  /** a voz dele (e o som da tela que ele compartilhar) */
  audio?: MediaStream;
  /** a tela dele, quando está compartilhando */
  video?: MediaStream;
  /** 0 a 1 — o quanto está falando agora */
  volume: number;
  /** estado da conexão direta com esta pessoa */
  conexao: RTCPeerConnectionState | "aguardando";
};

export type Mensagem = {
  id: string;
  de: string;
  nome: string;
  texto: string;
  em: number;
  /** foi o próprio servidor quem disse (entrou, saiu, erro) */
  sistema?: boolean;
};

export type EstadoMalha = {
  voceId: string | null;
  ligado: boolean;
  erro: string | null;
  participantes: Participante[];
  mensagens: Mensagem[];
  mudo: boolean;
  tela: boolean;
  /** volume do próprio microfone, para o indicador de fala */
  meuVolume: number;
  /**
   * A minha captura de tela trouxe som?
   *
   * Vale a pena estar no estado, e não só num aviso no chat: é a diferença
   * entre a pessoa descobrir agora, olhando para a barra de telas, e descobrir
   * dez minutos depois pelo outro lado dizendo que o vídeo está mudo.
   */
  telaComSom: boolean;
  qualidade: Qualidade;
};

type Ouvinte = (e: EstadoMalha) => void;

/**
 * Servidores de descoberta.
 *
 * O STUN só descobre o próprio endereço público — resolve a maioria das casas.
 * O TURN **retransmite** quando a conexão direta não fecha (NAT simétrico,
 * rede de empresa), e é a diferença entre "às vezes funciona" e "funciona".
 * Não vem embutido porque TURN gasta banda de verdade e precisa ser de alguém:
 * configure em `NVDISC_TURN_URL` (ver README).
 */
function servidores(): RTCIceServer[] {
  const lista: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  const turn = process.env.NEXT_PUBLIC_TURN_URL;
  if (turn) {
    lista.push({
      urls: turn,
      username: process.env.NEXT_PUBLIC_TURN_USER,
      credential: process.env.NEXT_PUBLIC_TURN_SENHA,
    });
  }
  return lista;
}


// ------------------------------------------------------------ qualidade --

export type Qualidade = {
  /**
   * `voz` — o processamento do navegador ligado (cancelamento de eco, supressão
   * de ruído, ganho automático). É o que impede microfonia quando alguém está
   * no alto-falante, e o que a maioria quer.
   *
   * `musica` — tudo isso desligado, estéreo, taxa alta. Um instrumento, um
   * vídeo ou uma voz cantando passam sem o processamento comer os agudos e a
   * dinâmica. **Peça fone a todo mundo**: sem cancelamento de eco, alto-falante
   * aberto vira realimentação em segundos.
   */
  audio: "voz" | "musica";
  /**
   * Quanto ruído de fundo abafar.
   *
   * `desligado` — nada é tirado. É o certo quando o som importa mais que o
   * silêncio: instrumento, vídeo, uma voz cantando.
   *
   * `padrao` — o supressor do navegador, que tira ventilador, teclado e
   * chiado sem tocar na voz. Serve para quase todo mundo.
   *
   * `forte` — o do navegador **mais** uma porta: abaixo de um certo volume o
   * microfone é fechado, e o que passa é só quando você fala. Resolve obra na
   * rua e cachorro no quintal, e cobra por isso: começo de palavra dita
   * baixinho pode se perder, e respiração some. Numa conversa de duas pessoas
   * é ótimo; numa roda em que gente ri junto, incomoda.
   */
  ruido: "desligado" | "padrao" | "forte";
  /** altura da tela transmitida; 0 = como está no monitor */
  resolucao: 0 | 720 | 1080 | 1440 | 2160;
  fps: 30 | 60;
  /**
   * O que sacrificar quando a banda aperta — e sempre aperta em algum momento.
   *
   * `nitidez` mantém a resolução e derruba os quadros: é o certo para código,
   * planilha, slide, qualquer coisa com texto. Texto borrado não se lê.
   *
   * `movimento` mantém os quadros e derruba a resolução: é o certo para vídeo
   * e jogo, onde o que incomoda é o soluço.
   */
  perfil: "nitidez" | "movimento";
};

export const QUALIDADE_PADRAO: Qualidade = {
  audio: "voz",
  ruido: "padrao",
  resolucao: 1080,
  fps: 30,
  perfil: "nitidez",
};

/**
 * Quanto o vídeo pode gastar, por pessoa na sala.
 *
 * A malha manda **uma cópia para cada participante**: com 1080p a 5 Mbps e
 * quatro pessoas ouvindo, são 20 Mbps de subida — mais do que a maioria das
 * casas tem. Por isso o teto total, dividido pelo número de pares.
 *
 * O limite total é conservador de propósito: estourar a subida não degrada
 * suavemente, ele enfileira e a chamada inteira começa a travar — inclusive a
 * voz, que é o que menos pode faltar.
 */
const TETO_SUBIDA = 12_000_000;

function bitrateVideo(q: Qualidade, pares: number): number {
  const base: Record<number, number> = {
    0: 6_000_000, // "como está" — supõe algo perto de 1080p
    720: 2_500_000,
    1080: 5_000_000,
    1440: 8_000_000,
    2160: 16_000_000,
  };
  const alvo = (base[q.resolucao] ?? 5_000_000) * (q.fps === 60 ? 1.6 : 1);
  const cabe = TETO_SUBIDA / Math.max(1, pares);
  return Math.round(Math.min(alvo, cabe));
}

/** Taxa do Opus. O `musica` é estéreo, por isso o dobro largo. */
function bitrateAudio(q: Qualidade): number {
  return q.audio === "musica" ? 256_000 : 96_000;
}

/**
 * Ajusta o Opus no SDP.
 *
 * O padrão do WebRTC é mono a ~32 kbps com DTX — feito para caber em rede de
 * celular de 2015, e é a razão de a voz soar "de telefone". Estas quatro
 * chaves mudam isso:
 *
 * - `maxaveragebitrate` — a taxa que o codificador pode usar;
 * - `stereo`/`sprop-stereo` — dois canais, para o modo música;
 * - `useinbandfec=1` — o Opus embute redundância e recupera pacote perdido
 *   sozinho, o que é exatamente o que evita o "picote" em rede instável;
 * - `usedtx=0` — sem corte de transmissão no silêncio. O DTX economiza banda e
 *   come o começo das palavras faladas baixinho.
 *
 * Mexer no SDP à mão é feio e é o único caminho: não há API para isto.
 */
function ajustarOpus(sdp: string, q: Qualidade): string {
  const m = sdp.match(/a=rtpmap:(\d+) opus\/48000/);
  if (!m) return sdp;
  const pt = m[1];
  const estereo = q.audio === "musica";
  const chaves =
    `stereo=${estereo ? 1 : 0};sprop-stereo=${estereo ? 1 : 0};` +
    `maxaveragebitrate=${bitrateAudio(q)};maxplaybackrate=48000;` +
    `useinbandfec=1;usedtx=0`;

  const linha = new RegExp(`a=fmtp:${pt} (.*)`);
  if (linha.test(sdp)) {
    // Preserva o que já estava lá e sobrescreve só o que nos interessa.
    return sdp.replace(linha, (_, antigo: string) => {
      const mantidos = antigo
        .split(";")
        .filter((x) => !/^(stereo|sprop-stereo|maxaveragebitrate|maxplaybackrate|useinbandfec|usedtx)=/.test(x.trim()))
        .filter(Boolean);
      return `a=fmtp:${pt} ${[...mantidos, chaves].join(";")}`;
    });
  }
  return sdp.replace(`a=rtpmap:${pt} opus/48000`, `a=rtpmap:${pt} opus/48000/2\r\na=fmtp:${pt} ${chaves}`);
}

/** Uma conexão com uma pessoa. */
type Par = {
  pc: RTCPeerConnection;
  /** o lado que cede quando os dois falam ao mesmo tempo */
  educado: boolean;
  fazendoOferta: boolean;
  ignorandoOferta: boolean;
  /** o transceptor de vídeo, criado antes de existir tela para mandar */
  videoSender: RTCRtpSender | null;
  /** por onde a sua voz sai para esta pessoa (microfone, ou a mistura) */
  audioSender: RTCRtpSender | null;
  medidor?: Medidor;
};

/** Mede o quanto uma faixa de áudio está soando, para o indicador de fala. */
type Medidor = {
  contexto: AudioContext;
  analisador: AnalyserNode;
  /**
   * `Uint8Array<ArrayBuffer>`, e não só `Uint8Array`: desde o TypeScript 5.7 o
   * tipo é genérico no buffer, e `getByteFrequencyData` exige um `ArrayBuffer`
   * de verdade — um `SharedArrayBuffer` não serve. Sem esta anotação o
   * construtor infere `ArrayBufferLike` e a chamada não compila.
   */
  dados: Uint8Array<ArrayBuffer>;
  parar: () => void;
};

/**
 * **Um** contexto de áudio para a página inteira.
 *
 * A primeira versão criava um `AudioContext` por participante, e era a causa
 * do áudio travando: o Chrome permite cerca de **seis** por aba, e cada um é
 * uma thread de áudio com o seu próprio relógio. Numa sala de cinco pessoas o
 * limite era estourado e o som começava a picotar — sem erro nenhum, porque
 * nada "falha", só degrada.
 *
 * Um contexto e vários `AnalyserNode` fazem o mesmo trabalho com um relógio
 * só, e o custo passa a ser desprezível.
 */
let contextoUnico: AudioContext | null = null;

function contextoDeAudio(): AudioContext {
  if (!contextoUnico) contextoUnico = new AudioContext({ sampleRate: 48000 });
  // Navegador suspende o contexto quando a aba perde o foco; retomar aqui
  // evita o indicador de fala congelar ao voltar para a aba.
  if (contextoUnico.state === "suspended") void contextoUnico.resume();
  return contextoUnico;
}

function criarMedidor(fluxo: MediaStream): Medidor | undefined {
  const faixas = fluxo.getAudioTracks();
  if (faixas.length === 0) return undefined;
  const contexto = contextoDeAudio();
  const origem = contexto.createMediaStreamSource(fluxo);
  const analisador = contexto.createAnalyser();
  // Janela pequena: o indicador tem de acompanhar a fala, não a média dela.
  analisador.fftSize = 512;
  analisador.smoothingTimeConstant = 0.6;
  origem.connect(analisador);
  return {
    contexto,
    analisador,
    dados: new Uint8Array(new ArrayBuffer(analisador.frequencyBinCount)),
    parar: () => {
      try {
        origem.disconnect();
        analisador.disconnect();
        // O contexto **não** é fechado: ele é da página, não deste medidor.
        // Fechá-lo aqui derrubaria o indicador de fala de todo mundo.
      } catch {
        /* já desconectado */
      }
    },
  };
}

function nivel(m: Medidor | undefined): number {
  if (!m) return 0;
  m.analisador.getByteFrequencyData(m.dados);
  let soma = 0;
  for (const v of m.dados) soma += v;
  const media = soma / m.dados.length / 255;
  // O piso corta o ruído de fundo; sem ele o indicador pisca o tempo todo e
  // deixa de significar "esta pessoa está falando".
  return media < 0.04 ? 0 : Math.min(1, media * 3);
}

/**
 * Um identificador aleatório que funciona **fora de HTTPS**.
 *
 * `crypto.randomUUID` só existe em contexto seguro, e a sala é usada
 * exatamente onde não há um: alguém sobe o servidor no notebook e chama o
 * resto da casa pelo IP da rede (`http://192.168.x.x:3000`). Ali a função é
 * `undefined`, e a chamada estoura — o sintoma é entrar na sala e ficar
 * sozinho, com "reconectando…" eterno no topo e um `TypeError` que só aparece
 * para quem abre o console.
 *
 * O reserva não é criptográfico e não precisa ser: estes identificadores só
 * distinguem uma mensagem de outra e uma aba de outra dentro de uma sala que
 * já é pública para quem tem o código.
 */
function novoId(): string {
  try {
    if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* contexto sem crypto */
  }
  const acaso = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${acaso()}-${acaso()}`;
}

/**
 * O identificador **desta aba**.
 *
 * Vive no `sessionStorage`, e não no `localStorage`: ele precisa valer para
 * uma aba só. No `localStorage` duas abas do mesmo navegador dividiriam o
 * mesmo identificador e uma derrubaria a outra da sala — o oposto do que ele
 * existe para resolver.
 *
 * O servidor o usa para reconhecer a aba que volta (reconexão, recarga, ou o
 * remonte que o React faz em desenvolvimento) e tirar da sala a conexão
 * anterior dela. Sem isso, a conexão antiga fica lá como uma segunda pessoa
 * com o seu nome, e você entra na sala e vê dois "você".
 */
function idDaAba(): string {
  try {
    const guardado = limparSessao(sessionStorage.getItem("nvdisc:sessao"));
    if (guardado) return guardado;
    const novo = novoId();
    sessionStorage.setItem("nvdisc:sessao", novo);
    return novo;
  } catch {
    // Navegação privada com armazenamento bloqueado: um identificador só de
    // memória ainda cobre a reconexão desta página.
    return novoId();
  }
}

/**
 * A voz e o som da tela, numa faixa só.
 *
 * Compartilhar um vídeo sem som é a reclamação mais óbvia que a sala pode
 * receber, e a captura de tela **já traz** o áudio quando o navegador deixa —
 * ele só estava sendo jogado fora.
 *
 * Mandar como uma segunda faixa parece o caminho natural e é o caro: obriga a
 * renegociar a conexão com todo mundo no momento em que a pessoa aperta
 * "compartilhar", que é exatamente onde a malha costuma quebrar. Misturar os
 * dois num único fluxo mantém a promessa que sustenta esta arquitetura — uma
 * seção de áudio e uma de vídeo, criadas uma vez, trocadas com `replaceTrack`
 * e nunca renegociadas.
 *
 * O microfone continua entrando pela faixa dele, então **mudo continua sendo
 * mudo**: a faixa desligada não produz som, e o que sobra na mistura é só o
 * som da tela — que é o que se quer quando alguém silencia o microfone no
 * meio de um vídeo.
 */
type Cadeia = {
  /** a faixa que sai daqui para todo mundo */
  faixa: MediaStreamTrack;
  /** o portão do microfone, quando a supressão forte está ligada */
  porta: GainNode | null;
  desmontar: () => void;
};

/**
 * Monta o que sai deste navegador: microfone, porta de ruído e som da tela.
 *
 * Ela só é montada quando há motivo — supressão forte ligada, ou uma tela
 * compartilhada com som. No caso comum, a faixa do microfone vai crua, sem
 * nenhum nó de áudio no caminho, que é o que soa melhor e custa menos.
 *
 * A porta é um `GainNode` que o laço de volume abre e fecha: abaixo do
 * limiar, o ganho vai a zero. Um `DynamicsCompressor` faria algo parecido com
 * menos controle — e o que se quer aqui é justamente o controle, porque o
 * ponto de corte é a diferença entre "sumiu o ventilador" e "sumiu o começo
 * das minhas frases".
 */
function montarCadeia(
  mic: MediaStream | null,
  extras: (MediaStream | null)[],
  comPorta: boolean,
): Cadeia | null {
  const comSom = extras.filter((f): f is MediaStream => (f?.getAudioTracks().length ?? 0) > 0);
  if (!mic?.getAudioTracks().length && comSom.length === 0) return null;
  if (!comPorta && comSom.length === 0) return null;

  const contexto = contextoDeAudio();
  const destino = contexto.createMediaStreamDestination();
  const desfazer: (() => void)[] = [];
  let porta: GainNode | null = null;

  if (mic?.getAudioTracks().length) {
    const origem = contexto.createMediaStreamSource(mic);
    let ultimo: AudioNode = origem;
    if (comPorta) {
      // Corte grave: ronco de ar-condicionado e trepidação de mesa vivem
      // abaixo da voz, e tirá-los antes da porta faz a porta errar menos.
      const grave = contexto.createBiquadFilter();
      grave.type = "highpass";
      grave.frequency.value = 95;
      ultimo.connect(grave);
      ultimo = grave;

      porta = contexto.createGain();
      porta.gain.value = 0;
      ultimo.connect(porta);
      ultimo = porta;
      desfazer.push(() => grave.disconnect());
    }
    ultimo.connect(destino);
    desfazer.push(() => origem.disconnect());
    if (porta) desfazer.push(() => porta?.disconnect());
  }

  for (const fonte of comSom) {
    const origem = contexto.createMediaStreamSource(fonte);
    origem.connect(destino);
    desfazer.push(() => origem.disconnect());
  }

  return {
    faixa: destino.stream.getAudioTracks()[0],
    porta,
    desmontar: () => {
      for (const f of desfazer) {
        try {
          f();
        } catch {
          /* já desconectado */
        }
      }
      // O contexto é da página; fechá-lo derrubaria o indicador de fala de
      // todo mundo.
      destino.disconnect();
    },
  };
}

/**
 * O limiar da porta, no mesmo mundo do medidor.
 *
 * Escolhido acima do ruído de sala típico (ventilador, geladeira, rua fechada)
 * e abaixo de fala normal, inclusive de quem fala baixo. Mais alto do que isto
 * começa a cortar gente; mais baixo deixa o ventilador passar e a porta perde
 * a razão de existir.
 */
const LIMIAR_DA_PORTA = 0.035;

/** O nível medido sem o piso que o indicador de fala aplica. */
function nivelBruto(m: Medidor | undefined): number {
  if (!m) return 0;
  m.analisador.getByteFrequencyData(m.dados);
  let soma = 0;
  for (const v of m.dados) soma += v;
  return soma / m.dados.length / 255;
}

export class Malha {
  private ws: WebSocket | null = null;
  /** o transporte quando a sala vive no Realtime do Supabase */
  private supabase: ReturnType<typeof criarSinalSupabase> | null = null;
  private pares = new Map<string, Par>();
  private meuFluxo: MediaStream | null = null;
  private fluxoTela: MediaStream | null = null;
  private meuMedidor?: Medidor;
  private cadeia: Cadeia | null = null;
  private quadro = 0;
  private pingTimer?: ReturnType<typeof setInterval>;
  private ouvinte: Ouvinte;
  private fechando = false;
  /** guardados para poder reentrar depois de uma queda */
  private sala = "";
  private nome = "";
  private sessao = "";
  private tentativa = 0;
  /** já houve conexão alguma vez? separa "caiu" de "nunca existiu" */
  private jaAbriu = false;
  private apurar?: ReturnType<typeof setTimeout>;
  private religar?: ReturnType<typeof setTimeout>;

  private estado: EstadoMalha = {
    voceId: null,
    ligado: false,
    erro: null,
    participantes: [],
    mensagens: [],
    mudo: false,
    tela: false,
    meuVolume: 0,
    telaComSom: false,
    qualidade: { ...QUALIDADE_PADRAO },
  };

  constructor(ouvinte: Ouvinte) {
    this.ouvinte = ouvinte;
  }

  private avisar() {
    // Cópia rasa: o React precisa de um objeto novo para reagir.
    this.ouvinte({ ...this.estado, participantes: [...this.estado.participantes] });
  }

  /**
   * Quem liga para quem.
   *
   * Exatamente um dos dois lados precisa propor a conexão; se os dois
   * propuserem, a negociação vira uma briga, e se nenhum propuser, a chamada
   * nunca começa. A regra antiga era a ordem de chegada — quem chega liga
   * para quem já estava —, e ela depende de alguém saber a ordem. O servidor
   * sabia. A **presença** de um canal não sabe: cada lado pode descobrir o
   * outro depois de já ter se apresentado, e aí os dois se acham veteranos e
   * ficam esperando um pelo outro para sempre. Foi exatamente o que
   * aconteceu: duas conexões criadas, nenhuma faixa, nenhum som.
   *
   * A comparação dos identificadores não depende de ordem nem de quem viu o
   * quê primeiro: é a mesma conta nos dois navegadores e dá sempre respostas
   * opostas. Vale para qualquer transporte, e é uma coisa a menos que precisa
   * dar certo.
   */
  private euLigoPara(outroId: string) {
    return (this.estado.voceId ?? "") > outroId;
  }

  /**
   * A faixa de áudio que sai desta pessoa **agora**.
   *
   * É o microfone no caso comum, e a mistura de microfone com o som da tela
   * enquanto alguém compartilha algo que faz barulho. Quem pergunta não
   * precisa saber em qual dos dois estados a sala está.
   */
  private vozParaEnviar(): MediaStreamTrack | null {
    return this.cadeia?.faixa ?? this.meuFluxo?.getAudioTracks()[0] ?? null;
  }

  /**
   * Refaz o caminho do som e entrega a faixa nova a quem já está na chamada.
   *
   * É chamada quando muda alguma coisa que altera esse caminho: a supressão,
   * o compartilhamento de tela, o microfone. Trocar a faixa não renegocia
   * nada — a conexão nem percebe.
   */
  /**
   * Abre e fecha a porta de ruído conforme você fala.
   *
   * Rápido para abrir e devagar para fechar, e é isso que separa uma porta
   * útil de uma que estraga a conversa: abrir devagar come o começo das
   * palavras; fechar rápido corta o fim delas e faz a sala "engolir" o final
   * das frases. Um limiar em cima do nível medido, e não em decibéis
   * absolutos, porque o que importa é o quanto a voz se destaca do fundo
   * daquele microfone.
   */
  private ajustarPorta() {
    const porta = this.cadeia?.porta;
    if (!porta) return;
    const contexto = porta.context;
    const falando = nivelBruto(this.meuMedidor) > LIMIAR_DA_PORTA;
    const alvo = falando && !this.estado.mudo ? 1 : 0;
    // `setTargetAtTime` faz a transição no próprio motor de áudio, sem
    // depender do relógio do JavaScript — que é justamente o que costuma
    // engasgar quando a página está ocupada.
    porta.gain.setTargetAtTime(alvo, contexto.currentTime, alvo === 1 ? 0.008 : 0.18);
  }

  private async refazerCadeia() {
    const comPorta = this.estado.qualidade.ruido === "forte";
    this.cadeia?.desmontar();
    this.cadeia = montarCadeia(this.meuFluxo, [this.fluxoTela], comPorta);
    await this.trocarVoz();
  }

  /** Troca a faixa de voz em todas as conexões abertas, sem renegociar nada. */
  private async trocarVoz() {
    const voz = this.vozParaEnviar();
    if (!voz) return;
    for (const par of this.pares.values()) {
      try {
        await this.senderDeAudio(par)?.replaceTrack(voz);
      } catch {
        /* conexão indo embora */
      }
    }
  }

  /**
   * Por onde a voz sai para esta pessoa.
   *
   * O caminho guardado no `par` é o comum, e ele nem sempre existe: quem
   * atende só o registra se tiver pendurado o microfone naquele transceptor,
   * e há ordens de negociação em que isso não acontece. Quando não existe, a
   * conexão ainda sabe responder — o transceptor de áudio está lá, com ou sem
   * faixa nele.
   *
   * A diferença aparecia no pior momento possível: quem compartilhava uma aba
   * com som via a mistura ser feita direitinho e ficar parada, porque não
   * havia a quem entregá-la. O vídeo ia, o som não, e nada no console dizia
   * por quê.
   */
  private senderDeAudio(par: Par): RTCRtpSender | null {
    if (par.audioSender) return par.audioSender;
    for (const t of par.pc.getTransceivers()) {
      const ehAudio =
        t.sender.track?.kind === "audio" || t.receiver.track?.kind === "audio";
      if (ehAudio) {
        par.audioSender = t.sender;
        return t.sender;
      }
    }
    return null;
  }

  private acha(id: string) {
    return this.estado.participantes.find((p) => p.id === id);
  }

  private sistema(texto: string) {
    this.estado.mensagens = [
      ...this.estado.mensagens,
      {
        id: novoId(),
        de: "sistema",
        nome: "",
        texto,
        em: Date.now(),
        sistema: true,
      },
    ].slice(-400);
  }

  // ------------------------------------------------------------- entrada --

  async entrar(sala: string, nome: string) {
    this.sala = sala;
    this.nome = nome;
    this.sessao = idDaAba();
    try {
      // O microfone é pedido **antes** de conectar. Se a permissão for negada,
      // é melhor descobrir agora do que depois de estar na sala mudo sem saber
      // por quê. `echoCancellation` e companhia importam mais aqui do que em
      // qualquer outro lugar: sem elas, dois na mesma casa viram microfonia.
      this.meuFluxo = await navigator.mediaDevices.getUserMedia({
        audio: this.restricoesDeAudio(),
        video: false,
      });
      this.meuMedidor = criarMedidor(this.meuFluxo);
    } catch {
      // Duas causas, e confundi-las custa uma noite: sem HTTPS o navegador
      // nem oferece o microfone — não adianta procurar permissão para dar,
      // porque não existe. Dizer "dê a permissão" nesse caso manda a pessoa
      // caçar um botão que não está em lugar nenhum.
      this.estado.erro = !window.isSecureContext
        ? "sem HTTPS o navegador não entrega o microfone — é regra dele, não " +
          "deste site. Abrindo por um endereço de rede (http://192.168…) dá " +
          "para ver quem está na sala e usar o chat, mas não a voz. Para falar, " +
          "acesse por HTTPS ou pelo próprio computador (localhost)."
        : "não consegui acessar o microfone. Dê a permissão no navegador e recarregue — " +
          "sem ele dá para usar o chat, mas não a voz.";
      this.avisar();
    }

    // `sair()` pode ter acontecido enquanto o navegador decidia sobre o
    // microfone — a pessoa fechou a aba, voltou para a entrada, ou o React
    // desmontou e remontou o componente. Sem esta guarda, a conexão abriria
    // **depois** do pedido de saída e ficaria pendurada na sala: uma segunda
    // pessoa com o seu nome, que só some quando a varredura do servidor a
    // derruba.
    if (this.fechando) {
      this.meuMedidor?.parar();
      this.meuFluxo?.getTracks().forEach((f) => f.stop());
      return;
    }

    this.abrirSinalizacao();
    this.laçoDeVolume();
  }

  /**
   * Por onde as pessoas da sala são apresentadas.
   *
   * Com Supabase configurado, o navegador fala direto com o Realtime dele e
   * não há servidor de sinalização nenhum — é o arranjo para quando as
   * páginas moram numa hospedagem sem processo. Sem ele, vale o WebSocket do
   * `server.mjs`, que é a casa natural desta ferramenta.
   *
   * A escolha é do ambiente, não do código: as duas pontas entregam à malha
   * exatamente as mesmas mensagens.
   */
  private supabaseConfigurado() {
    return configuracaoDoNavegador();
  }

  /**
   * Abre (ou reabre) a conexão com o servidor de sinalização.
   *
   * Separado do `entrar` porque a queda de rede é o caso comum, não a exceção:
   * Wi-Fi que oscila, celular que troca de antena, notebook que dorme. Sem
   * religar sozinho, a sala parece funcionar até o momento em que para para
   * sempre, e a única saída visível é recarregar a página.
   */
  /**
   * O endereço da sinalização.
   *
   * Por padrão é o mesmo servidor que entregou a página, que é o caso quando
   * o `server.mjs` serve tudo. `NEXT_PUBLIC_SINAL_URL` existe para o arranjo
   * em que as páginas estão numa hospedagem sem processo (Vercel e parentes,
   * onde só há função serverless) e o processo da sinalização vive noutro
   * lugar — sem ela, esse arranjo não tem como funcionar, porque não há
   * WebSocket num servidor que nasce e morre a cada requisição.
   */
  private enderecoDaSinalizacao(): string {
    const configurado = process.env.NEXT_PUBLIC_SINAL_URL;
    if (configurado) {
      const limpo = configurado.replace(/\/+$/, "");
      return /^wss?:/.test(limpo)
        ? `${limpo}${CAMINHO_SINAL}`
        : limpo.replace(/^http/, "ws") + CAMINHO_SINAL;
    }
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.host}${CAMINHO_SINAL}`;
  }

  private abrirSinalizacao() {
    if (this.fechando) return;

    const config = this.supabaseConfigurado();
    if (config) {
      this.supabase?.fechar();
      this.supabase = criarSinalSupabase(config, {
        sala: this.sala,
        nome: this.nome,
        sessao: this.sessao,
        recebeu: (msg) => void this.recebeu(msg),
        ligou: () => {
          this.jaAbriu = true;
          this.tentativa = 0;
          if (this.apurar) clearTimeout(this.apurar);
        },
        caiu: () => {
          if (this.fechando) return;
          this.estado.ligado = false;
          this.avisar();
        },
      });
      this.supabase.abrir();
      // O cliente do Supabase religa sozinho; a apuração existe só para o
      // caso de ele nunca chegar a conectar (credencial errada, projeto
      // pausado), que é quando ficar em "reconectando…" não explica nada.
      if (this.apurar) clearTimeout(this.apurar);
      this.apurar = setTimeout(() => {
        if (!this.jaAbriu) {
          this.estado.erro =
            "não consegui falar com o Supabase, que é quem apresenta as pessoas " +
            "desta sala. Confira NEXT_PUBLIC_SUPABASE_URL e a chave publicável " +
            "nas variáveis do projeto.";
          this.avisar();
        }
      }, 8000);
      return;
    }
    const ws = new WebSocket(this.enderecoDaSinalizacao());
    this.ws = ws;

    // Um endereço sem sinalização se comporta de dois jeitos, e nenhum deles
    // é um erro claro: em hospedagem serverless o handshake volta 404 e o
    // socket fecha na hora; num Next servido sozinho ele fica **pendurado**,
    // sem abrir, sem fechar e sem erro. Por isso a apuração é por tempo, e
    // não por evento — seis segundos é mais do que qualquer conexão honesta
    // precisa e menos do que a paciência de quem está esperando entrar.
    if (this.apurar) clearTimeout(this.apurar);
    this.apurar = setTimeout(() => {
      if (this.ws === ws && ws.readyState !== WebSocket.OPEN) void this.diagnosticar();
    }, 6000);

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.jaAbriu = true;
      if (this.apurar) clearTimeout(this.apurar);
      this.tentativa = 0;
      // `sessao` diz ao servidor que esta aba é a mesma de antes, para ele
      // tirar da sala a conexão anterior dela em vez de somar mais uma pessoa.
      this.manda(PARA_SERVIDOR.ENTRAR, {
        sala: this.sala,
        nome: this.nome,
        sessao: this.sessao,
      });
      // Proxies e roteadores derrubam conexão parada. Vinte segundos fica
      // abaixo do tempo de corte de praticamente todos eles.
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.manda(PARA_SERVIDOR.PING), 20_000);
    };
    ws.onmessage = (ev) => {
      // Um socket substituído por uma reconexão ainda entrega o que estava a
      // caminho; aceitar isso misturaria a lista de participantes de duas
      // sessões.
      if (this.ws !== ws) return;
      this.recebeu(JSON.parse(ev.data));
    };
    ws.onclose = () => {
      if (this.fechando || this.ws !== ws) return;
      this.estado.ligado = false;
      this.avisar();
      this.agendarReconexao();
    };
  }

  /**
   * Por que a conexão nunca abriu.
   *
   * "Reconectando…" é a mensagem certa para Wi-Fi que oscila, e a errada para
   * um endereço que **não tem** servidor de sinalização — ali não há o que
   * reconectar, e a pessoa fica olhando para uma sala que nunca vai encher.
   *
   * A diferença se descobre com uma requisição comum ao mesmo caminho: se
   * alguém responde um HTTP normal (404, ou a própria página), então o
   * servidor está de pé mas não fala WebSocket. É o que acontece em
   * hospedagem serverless, onde o `server.mjs` não roda — e é exatamente o
   * caso que dá dias de "não consigo entrar na mesma sala que você".
   */
  private async diagnosticar() {
    if (this.jaAbriu) return;
    const endereco = this.enderecoDaSinalizacao().replace(/^ws/, "http");
    try {
      const r = await fetch(endereco, { method: "GET" });
      this.estado.erro =
        `este endereço não tem servidor de sinalização (respondeu ${r.status} a ` +
        `${CAMINHO_SINAL}). O NVDISC precisa de um processo de pé para apresentar ` +
        `as pessoas de uma sala — em hospedagem serverless ele não roda, e ninguém ` +
        `chega a se ver. Veja "Onde isto pode rodar" no README.`;
      this.avisar();
    } catch {
      /* sem resposta nenhuma: aí é rede mesmo, e "reconectando…" está certo */
    }
  }

  private agendarReconexao() {
    if (this.fechando || this.religar) return;
    // 1s, 2s, 4s, 8s, e daí em diante de 10 em 10. Insistir de meio em meio
    // segundo martela o servidor sem ajudar ninguém; desistir deixa a pessoa
    // olhando para uma sala morta.
    const espera = Math.min(10_000, 1000 * 2 ** this.tentativa);
    this.tentativa += 1;
    if (this.tentativa === 1 && this.jaAbriu) {
      this.sistema("a conexão caiu; tentando voltar…");
    }

    this.religar = setTimeout(() => {
      this.religar = undefined;
      // **As conexões de áudio ficam de pé.**
      //
      // Elas não passam pelo servidor: são diretas entre os navegadores, e a
      // queda da sinalização não as afeta em nada. Desfazê-las aqui — que era
      // o que este trecho fazia — cortava a voz de todo mundo a cada
      // reconexão, e é o que tornaria a sala inutilizável numa hospedagem que
      // derruba a conexão de tempos em tempos por projeto (a Vercel corta a
      // função em cinco minutos).
      //
      // O que torna isso possível é o identificador do participante ser a
      // aba, e não a conexão: quem volta volta com o mesmo nome de sempre, e
      // os pares continuam válidos.
      this.abrirSinalizacao();
    }, espera);
  }

  /**
   * O que pedir ao microfone.
   *
   * `sampleRate: 48000` e `channelCount` explícitos: sem pedir, o Chrome
   * costuma entregar 44.1 kHz mono e o Opus reamostra, o que já custa
   * qualidade antes de qualquer codificação.
   *
   * No modo música o processamento sai inteiro. Ele foi feito para fala: o
   * supressor de ruído confunde sustentação de instrumento com chiado, e o
   * ganho automático achata a dinâmica — os dois destroem música.
   */
  private restricoesDeAudio(): MediaTrackConstraints {
    const q = this.estado.qualidade;
    const musica = q.audio === "musica";
    // O cancelamento de eco fica ligado mesmo com a supressão desligada: ele
    // não existe para limpar ruído, e sim para impedir que o alto-falante de
    // alguém volte para a sala como microfonia.
    return {
      echoCancellation: !musica,
      noiseSuppression: !musica && q.ruido !== "desligado",
      autoGainControl: !musica,
      sampleRate: 48000,
      sampleSize: 16,
      channelCount: musica ? 2 : 1,
    };
  }

  private manda(tipo: string, corpo: Record<string, unknown> = {}) {
    if (this.supabase) {
      this.supabase.manda(tipo, corpo);
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ tipo, ...corpo }));
    }
  }

  // ------------------------------------------------------- o que chega --

  /**
   * O que chega do servidor.
   *
   * O tipo é frouxo de propósito: são dados de rede, e fingir que já vêm
   * tipados só esconderia a conversão. Cada ramo do `switch` afirma o formato
   * daquela mensagem, que é onde o formato de fato se conhece.
   */
  private async recebeu(msg: Record<string, unknown>) {
    switch (msg.tipo as string) {
      case PARA_CLIENTE.BEMVINDO: {
        this.estado.voceId = msg.voceId as string;
        this.estado.ligado = true;
        this.estado.erro = null;
        if (this.tentativa > 0) this.sistema("conexão restabelecida.");
        const gente = msg.participantes as Omit<Participante, "volume" | "conexao">[];
        // Numa reconexão a lista chega de novo, e as pessoas dela podem já
        // estar aqui, com áudio tocando. O que veio do servidor é o cadastro
        // (nome, microfone, tela); o que já existe é a mídia — e ela não se
        // recria só porque a sinalização piscou.
        this.estado.participantes = gente.map((p) => {
          const antes = this.acha(p.id);
          return {
            ...p,
            audio: antes?.audio,
            video: antes?.video,
            volume: antes?.volume ?? 0,
            conexao: antes?.conexao ?? ("aguardando" as const),
          };
        });
        // Quem sumiu da lista enquanto estávamos fora saiu de verdade.
        for (const id of [...this.pares.keys()]) {
          if (!gente.some((p) => p.id === id)) this.fecharPar(id);
        }
        for (const p of gente) await this.abrirPar(p.id, this.euLigoPara(p.id));
        this.avisar();
        break;
      }

      case PARA_CLIENTE.ENTROU: {
        const p = msg as unknown as Omit<Participante, "volume" | "conexao">;
        if (!this.acha(p.id)) {
          this.estado.participantes.push({ ...p, volume: 0, conexao: "aguardando" });
        }
        this.sistema(`${p.nome} entrou`);
        await this.abrirPar(p.id, this.euLigoPara(p.id));
        this.avisar();
        break;
      }

      case PARA_CLIENTE.SAIU: {
        const id = msg.id as string;
        const p = this.acha(id);
        if (p) this.sistema(`${p.nome} saiu`);
        this.fecharPar(id);
        this.estado.participantes = this.estado.participantes.filter((x) => x.id !== id);
        this.avisar();
        break;
      }

      case PARA_CLIENTE.SINAL:
        await this.sinalRecebido(
          msg.de as string,
          msg.dados as { descricao?: RTCSessionDescriptionInit; candidato?: RTCIceCandidateInit },
        );
        break;

      case PARA_CLIENTE.CHAT:
        this.estado.mensagens = [
          ...this.estado.mensagens,
          {
            id: novoId(),
            de: msg.de as string,
            nome: msg.nome as string,
            texto: msg.texto as string,
            em: msg.em as number,
          },
        ].slice(-400);
        this.avisar();
        break;

      case PARA_CLIENTE.ESTADO: {
        const p = this.acha(msg.id as string);
        if (p) {
          p.mudo = msg.mudo as boolean;
          p.tela = msg.tela as boolean;
          this.avisar();
        }
        break;
      }

      case PARA_CLIENTE.ERRO:
        this.estado.erro = msg.motivo as string;
        this.avisar();
        break;
    }
  }

  // --------------------------------------------------------- as conexões --

  private async abrirPar(outroId: string, euLigo: boolean): Promise<Par> {
    const existente = this.pares.get(outroId);
    if (existente) return existente;

    const pc = new RTCPeerConnection({ iceServers: servidores() });
    const par: Par = {
      pc,
      // O papel de "educado" sai da comparação dos identificadores: os dois
      // navegadores fazem a mesma conta e chegam a papéis opostos, sem
      // precisar combinar. É o que resolve o empate quando os dois propõem
      // mudança ao mesmo tempo.
      educado: (this.estado.voceId ?? "") > outroId,
      fazendoOferta: false,
      ignorandoOferta: false,
      videoSender: null,
      audioSender: null,
    };
    this.pares.set(outroId, par);

    /**
     * **Só quem liga monta os transceptores.**
     *
     * Parece natural os dois lados montarem os seus — e é o que a primeira
     * versão fazia. O resultado, medido: a negociação terminava com **duas**
     * seções de vídeo, e o remetente de áudio de um lado não casava com o
     * receptor do outro. A chamada ficava `connected`, as faixas existiam, e
     * mesmo assim um dos dois não ouvia nada.
     *
     * Quem atende recebe os transceptores prontos do `setRemoteDescription`, e
     * pendura o microfone neles em `prepararResposta`. Assim há uma lista de
     * seções só, na ordem de quem ofereceu, e ela casa dos dois lados.
     */
    if (euLigo) {
      const voz = this.vozParaEnviar();
      if (voz) par.audioSender = pc.addTrack(voz, this.meuFluxo ?? new MediaStream([voz]));
      // O transceptor de vídeo nasce vazio e fica pronto. Ver a nota no topo:
      // é isto que faz ligar a tela não renegociar nada.
      const tv = pc.addTransceiver("video", { direction: "sendrecv" });
      par.videoSender = tv.sender;
      if (this.fluxoTela) {
        const faixa = this.fluxoTela.getVideoTracks()[0];
        if (faixa) await tv.sender.replaceTrack(faixa);
      }
    }

    /**
     * O que chega do outro lado.
     *
     * **Áudio e vídeo em fluxos separados**, e isto é o conserto de um defeito
     * real: a versão anterior fazia `p.fluxo = ev.streams[0]` e o transceptor
     * de vídeo — que existe desde o começo, mesmo sem ninguém compartilhando
     * tela — disparava `ontrack` com um fluxo sem faixa de áudio, sobrescrevendo
     * a voz que já havia chegado. O elemento de áudio ficava ligado a um fluxo
     * mudo, e a sala inteira era silenciosa sem um erro sequer no console.
     *
     * Separando por `kind` não há ordem que quebre: cada faixa vai para o seu
     * lugar, e uma nunca apaga a outra.
     */
    pc.ontrack = (ev) => {
      const p = this.acha(outroId);
      if (!p) return;

      // Um `MediaStream` novo a cada faixa, e não `addTrack` no que já existe:
      // o React reconhece mudança por identidade, e um objeto alterado por
      // dentro não faria o `<audio>` religar no fluxo certo.
      const juntar = (atual: MediaStream | undefined) =>
        new MediaStream([
          ...(atual?.getTracks() ?? []).filter((t) => t.id !== ev.track.id),
          ev.track,
        ]);

      if (ev.track.kind === "audio") {
        p.audio = juntar(p.audio);
        const par2 = this.pares.get(outroId);
        if (par2) {
          // O medidor é refeito: ele mede o fluxo que existe agora, e o som da
          // tela compartilhada chega como uma segunda faixa de áudio.
          par2.medidor?.parar();
          par2.medidor = criarMedidor(p.audio);
        }
      } else {
        p.video = juntar(p.video);
      }

      // Faixa que termina (a pessoa parou de compartilhar) tem de sumir da
      // tela, senão fica um retângulo preto congelado no lugar dela.
      ev.track.onended = () => {
        const q = this.acha(outroId);
        if (!q) return;
        if (ev.track.kind === "audio") q.audio = undefined;
        else q.video = undefined;
        this.avisar();
      };

      this.avisar();
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.manda(PARA_SERVIDOR.SINAL, {
          para: outroId,
          dados: { candidato: ev.candidate },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const p = this.acha(outroId);
      if (p) {
        p.conexao = pc.connectionState;
        this.avisar();
      }
      // Os limites de taxa só valem depois que a conexão existe, e precisam
      // ser reaplicados a cada nova: um participante que chega no meio do
      // compartilhamento entraria com o padrão do navegador.
      if (pc.connectionState === "connected") void this.aplicarQualidade();
      // `failed` costuma ser NAT que não fechou. Reiniciar o ICE resolve boa
      // parte dos casos sem derrubar a chamada inteira.
      if (pc.connectionState === "failed") pc.restartIce();
    };

    pc.onnegotiationneeded = async () => {
      try {
        par.fazendoOferta = true;
        // A oferta é criada explicitamente para poder ajustar o Opus antes de
        // aplicá-la. O `setLocalDescription()` sem argumento, que a negociação
        // perfeita recomenda, não deixa mexer no SDP — e sem mexer a voz sai
        // em ~32 kbps mono, que é o som de telefone.
        const oferta = await pc.createOffer();
        oferta.sdp = ajustarOpus(oferta.sdp ?? "", this.estado.qualidade);
        await pc.setLocalDescription(oferta);
        this.manda(PARA_SERVIDOR.SINAL, {
          para: outroId,
          dados: { descricao: pc.localDescription },
        });
      } catch {
        /* a próxima negociação corrige */
      } finally {
        par.fazendoOferta = false;
      }
    };

    // Nada é disparado à mão: criar o transceptor já provocou o
    // `onnegotiationneeded` acima. Quem não liga simplesmente atende.
    return par;
  }

  /** Negociação perfeita, do jeito que o padrão descreve. */
  private async sinalRecebido(
    de: string,
    dados: { descricao?: RTCSessionDescriptionInit; candidato?: RTCIceCandidateInit },
  ) {
    const par = this.pares.get(de) ?? (await this.abrirPar(de, false));
    const { pc } = par;

    try {
      if (dados.descricao) {
        const ofertaConflitante =
          dados.descricao.type === "offer" &&
          (par.fazendoOferta || pc.signalingState !== "stable");

        // O lado mal-educado ignora a oferta de fora e mantém a sua; o
        // educado descarta a própria e aceita a de fora. Como os papéis são
        // sempre opostos, exatamente um dos dois cede — e a negociação anda.
        par.ignorandoOferta = !par.educado && ofertaConflitante;
        if (par.ignorandoOferta) return;

        await pc.setRemoteDescription(dados.descricao);
        if (dados.descricao.type === "offer") {
          // Antes de responder: pendurar o microfone e a tela nos transceptores
          // que a oferta acabou de criar. Feito **agora**, a resposta já sai
          // dizendo `sendrecv` e não é preciso uma segunda rodada.
          await this.prepararResposta(par);
          const resposta = await pc.createAnswer();
          resposta.sdp = ajustarOpus(resposta.sdp ?? "", this.estado.qualidade);
          await pc.setLocalDescription(resposta);
          this.manda(PARA_SERVIDOR.SINAL, {
            para: de,
            dados: { descricao: pc.localDescription },
          });
        }
      } else if (dados.candidato) {
        try {
          await pc.addIceCandidate(dados.candidato);
        } catch (e) {
          // Candidato que chega depois de uma oferta ignorada não tem onde
          // encaixar. É esperado, e não é erro.
          if (!par.ignorandoOferta) throw e;
        }
      }
    } catch {
      /* uma negociação perdida se refaz na próxima */
    }
  }

  /**
   * Prepara o lado que atende.
   *
   * O `setRemoteDescription` de uma oferta cria os transceptores, mas com
   * direção `recvonly`: do ponto de vista do padrão, quem atende ainda não
   * disse que tem algo a mandar. Sem pendurar a faixa e corrigir a direção
   * aqui, a resposta sai dizendo "só quero receber" — e o outro lado nunca
   * ouve esta pessoa, mesmo com tudo mais funcionando.
   */
  private async prepararResposta(par: Par) {
    const mic = this.vozParaEnviar();
    const tela = this.fluxoTela?.getVideoTracks()[0] ?? null;

    for (const t of par.pc.getTransceivers()) {
      const tipo = t.receiver.track?.kind;
      if (tipo === "audio" && !t.sender.track && mic) {
        par.audioSender = t.sender;
        await t.sender.replaceTrack(mic);
        t.direction = "sendrecv";
      }
      if (tipo === "video" && !par.videoSender) {
        par.videoSender = t.sender;
        if (tela) await t.sender.replaceTrack(tela);
        t.direction = "sendrecv";
      }
    }
  }

  private fecharPar(id: string) {
    const par = this.pares.get(id);
    if (!par) return;
    par.medidor?.parar();
    try {
      par.pc.close();
    } catch {
      /* já fechada */
    }
    this.pares.delete(id);
  }

  // ------------------------------------------------------------- ações --

  mudo(valor: boolean) {
    this.estado.mudo = valor;
    // Desligar a faixa é o que garante que nada sai: mexer só no volume
    // deixaria o áudio trafegando, e "mudo" precisa querer dizer mudo.
    this.meuFluxo?.getAudioTracks().forEach((f) => (f.enabled = !valor));
    // Com a cadeia montada, o que sai é a faixa dela — e uma faixa de saída
    // não obedece ao `enabled` do microfone. A porta fecha junto; sem isto,
    // "mudo" deixaria passar o som da tela **e** a voz que já estava no
    // caminho.
    this.ajustarPorta();
    this.manda(PARA_SERVIDOR.ESTADO, { mudo: valor, tela: this.estado.tela });
    this.avisar();
  }

  /**
   * Aplica os limites de envio em todas as conexões.
   *
   * É aqui que "alta qualidade" acontece de verdade. O SDP diz o que o codec
   * *pode* fazer; quem decide quanto ele *vai* gastar é isto — e sem mexer, o
   * Chrome trata compartilhamento de tela com uma taxa modesta e prefere
   * derrubar a resolução ao primeiro aperto, que é justamente o que borra o
   * texto e faz tudo parecer ruim.
   */
  private async aplicarQualidade() {
    const q = this.estado.qualidade;
    const pares = Math.max(1, this.pares.size);
    const alvoVideo = bitrateVideo(q, pares);
    const alvoAudio = bitrateAudio(q);

    for (const par of this.pares.values()) {
      for (const sender of par.pc.getSenders()) {
        const tipo = sender.track?.kind;
        if (!tipo) continue;
        const p = sender.getParameters();
        if (!p.encodings || p.encodings.length === 0) p.encodings = [{}];

        if (tipo === "video") {
          p.encodings[0].maxBitrate = alvoVideo;
          // Sem isto o navegador reduz a resolução ao primeiro aperto de
          // banda. Para texto, resolução é a última coisa que se pode perder.
          p.encodings[0].scaleResolutionDownBy = 1;
          p.degradationPreference =
            q.perfil === "nitidez" ? "maintain-resolution" : "maintain-framerate";
          if (q.fps === 60) p.encodings[0].maxFramerate = 60;
        } else {
          p.encodings[0].maxBitrate = alvoAudio;
          // A voz nunca é sacrificada por causa do vídeo: prioridade alta faz
          // o navegador servir este fluxo primeiro quando a banda aperta.
          p.encodings[0].priority = "high";
          p.encodings[0].networkPriority = "high";
        }
        try {
          await sender.setParameters(p);
        } catch {
          /* nem todo navegador aceita tudo; o que passar, passa */
        }
      }
    }
  }

  /** Troca a qualidade com a chamada em andamento. */
  async definirQualidade(q: Partial<Qualidade>) {
    const antes = this.estado.qualidade;
    const depois = { ...antes, ...q };
    this.estado.qualidade = depois;
    this.avisar();

    // O microfone só é repedido quando o que muda é ele: reabrir a captura à
    // toa corta o som de todo mundo por um instante.
    const mudouCaptura =
      (q.audio !== undefined && q.audio !== antes.audio) ||
      (q.ruido !== undefined &&
        // Só o `desligado` muda o que o navegador entrega; entre `padrao` e
        // `forte` o microfone é o mesmo, e o que muda é a porta — reabrir a
        // captura ali cortaria o som de todo mundo por nada.
        (q.ruido === "desligado") !== (antes.ruido === "desligado"));

    if (mudouCaptura) {
      try {
        const novo = await navigator.mediaDevices.getUserMedia({
          audio: this.restricoesDeAudio(),
          video: false,
        });
        novo.getAudioTracks().forEach((f) => (f.enabled = !this.estado.mudo));
        this.meuFluxo?.getTracks().forEach((f) => f.stop());
        this.meuFluxo = novo;
        this.meuMedidor?.parar();
        this.meuMedidor = criarMedidor(novo);
        // Quem decide o que sai é a cadeia: pode ser esta faixa crua, ou ela
        // passando pela porta e misturada ao som da tela.
        await this.refazerCadeia();
      } catch {
        this.estado.erro = "não consegui reabrir o microfone com a nova qualidade.";
      }
    }

    // A porta liga e desliga sem tocar no microfone.
    if (q.ruido !== undefined && q.ruido !== antes.ruido && !mudouCaptura) {
      await this.refazerCadeia();
    }

    // Já compartilhando: reajusta a captura sem interromper a transmissão.
    if (this.fluxoTela && (q.resolucao !== undefined || q.fps !== undefined)) {
      const faixa = this.fluxoTela.getVideoTracks()[0];
      try {
        await faixa?.applyConstraints(this.restricoesDeTela());
      } catch {
        /* o monitor pode não ter a resolução pedida; segue com a que dá */
      }
      if (faixa) faixa.contentHint = depois.perfil === "nitidez" ? "detail" : "motion";
    }

    await this.aplicarQualidade();
    this.avisar();
  }

  /**
   * O que pedir à captura de tela.
   *
   * `ideal` e não `exact`: um monitor de 1080p não tem 1440p para dar, e
   * `exact` faria a captura simplesmente falhar em vez de entregar o que
   * existe. Resolução `0` significa "como está no monitor" — não pedir nada é
   * o único jeito de obter o tamanho nativo, seja ele qual for.
   */
  private restricoesDeTela(): MediaTrackConstraints {
    const q = this.estado.qualidade;
    const v: MediaTrackConstraints = { frameRate: { ideal: q.fps, max: q.fps } };
    if (q.resolucao !== 0) {
      v.height = { ideal: q.resolucao };
      v.width = { ideal: Math.round((q.resolucao * 16) / 9) };
    }
    return v;
  }

  async alternarTela() {
    if (this.estado.tela) return this.pararTela();
    try {
      const fluxo = await navigator.mediaDevices.getDisplayMedia({
        video: this.restricoesDeTela(),
        // O áudio da tela vai junto quando o navegador deixa — é o que faz
        // vídeo compartilhado ter som.
        audio: true,
      });
      this.fluxoTela = fluxo;
      const faixa = fluxo.getVideoTracks()[0];
      // A dica de conteúdo muda o codificador: `detail` preserva bordas de
      // texto, `motion` aceita borrar um pouco para não perder quadro. É de
      // graça e faz diferença visível.
      faixa.contentHint = this.estado.qualidade.perfil === "nitidez" ? "detail" : "motion";
      // Parar pelo botão do próprio navegador tem de desligar aqui também,
      // senão o ícone continua aceso para todo mundo.
      faixa.onended = () => void this.pararTela();
      for (const par of this.pares.values()) {
        await par.videoSender?.replaceTrack(faixa);
      }
      // O som da tela entra na mesma faixa da voz.
      this.estado.telaComSom = fluxo.getAudioTracks().length > 0;
      await this.refazerCadeia();
      if (fluxo.getAudioTracks().length === 0) {
        // Dizer isto na hora poupa a descoberta pelo pior caminho, que é o
        // outro lado avisando que o vídeo está mudo depois de dez minutos.
        this.sistema(
          "esta captura veio sem som. O áudio só acompanha no Chrome, ao " +
            "compartilhar **uma aba** com a caixa de áudio marcada — tela inteira " +
            "e janela não levam som, e o Firefox não leva em caso nenhum.",
        );
      }
      this.estado.tela = true;
      this.manda(PARA_SERVIDOR.ESTADO, { mudo: this.estado.mudo, tela: true });
      await this.aplicarQualidade();
      this.avisar();
    } catch {
      /* o usuário cancelou a escolha da janela */
    }
  }

  async pararTela() {
    this.fluxoTela?.getTracks().forEach((f) => f.stop());
    this.fluxoTela = null;
    for (const par of this.pares.values()) {
      await par.videoSender?.replaceTrack(null);
    }
    // Sem tela, o caminho do som encolhe de novo — e volta a ser a faixa crua
    // do microfone, se a supressão forte não estiver ligada.
    this.estado.telaComSom = false;
    await this.refazerCadeia();
    this.estado.tela = false;
    this.manda(PARA_SERVIDOR.ESTADO, { mudo: this.estado.mudo, tela: false });
    this.avisar();
  }

  enviarChat(texto: string) {
    const t = texto.trim();
    if (t) this.manda(PARA_SERVIDOR.CHAT, { texto: t });
  }

  /** O fluxo de tela local, para a pré-visualização de quem compartilha. */
  get minhaTela() {
    return this.fluxoTela;
  }

  // ------------------------------------------------- indicador de fala --

  private laçoDeVolume() {
    /**
     * O indicador de fala é atualizado umas doze vezes por segundo, não a
     * sessenta.
     *
     * Cada atualização é um `setState` que redesenha a sala inteira. A
     * sessenta quadros, com o ruído de fundo de cinco pessoas mexendo no
     * valor o tempo todo, isso ocupa a thread principal quase por inteiro — e
     * thread principal ocupada é o que faz o áudio picotar e o mouse
     * engasgar. A doze, o olho não vê diferença (a animação do anel é do CSS,
     * não do React) e a máquina fica livre.
     */
    let ultimo = 0;
    const INTERVALO = 80;

    const passo = (agora: number) => {
      // A porta de ruído é decidida **a cada quadro**, e não a cada 80 ms
      // como o indicador: ela mexe no som, e som que abre com atraso perde a
      // primeira sílaba. É uma conta barata — nenhuma renderização depende
      // dela.
      this.ajustarPorta();

      if (agora - ultimo < INTERVALO) {
        this.quadro = requestAnimationFrame(passo);
        return;
      }
      ultimo = agora;
      let mudou = false;
      // Arredondar para um décimo corta a maior parte das atualizações: o
      // ruído de fundo oscila na terceira casa e não muda nada na tela.
      const passoDe = (v: number) => Math.round(v * 10) / 10;

      const meu = this.estado.mudo ? 0 : passoDe(nivel(this.meuMedidor));
      if (meu !== this.estado.meuVolume) {
        this.estado.meuVolume = meu;
        mudou = true;
      }
      for (const p of this.estado.participantes) {
        const v = p.mudo ? 0 : passoDe(nivel(this.pares.get(p.id)?.medidor));
        if (v !== p.volume) {
          p.volume = v;
          mudou = true;
        }
      }
      // Só avisa o React quando algo mudou de verdade. Sem esta guarda, a
      // sala inteira redesenha sessenta vezes por segundo por causa do ruído
      // de fundo de alguém.
      if (mudou) this.avisar();
      this.quadro = requestAnimationFrame(passo);
    };
    this.quadro = requestAnimationFrame(passo);
  }

  sair() {
    this.fechando = true;
    // Avisa que a saída é de propósito: sem isto o servidor não tem como
    // distinguir "fechei a aba" de "a conexão caiu e já volto", e teria de
    // esperar a carência antes de tirar você da lista dos outros.
    this.manda(PARA_SERVIDOR.SAIR);
    cancelAnimationFrame(this.quadro);
    if (this.apurar) clearTimeout(this.apurar);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.religar) clearTimeout(this.religar);
    this.meuMedidor?.parar();
    this.cadeia?.desmontar();
    this.cadeia = null;
    for (const id of [...this.pares.keys()]) this.fecharPar(id);
    this.meuFluxo?.getTracks().forEach((f) => f.stop());
    this.fluxoTela?.getTracks().forEach((f) => f.stop());
    try {
      this.ws?.close();
      void this.supabase?.fechar();
    } catch {
      /* já fechado */
    }
  }
}
