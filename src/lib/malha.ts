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

import { PARA_CLIENTE, PARA_SERVIDOR, LIMITES, limparSessao } from "./protocolo.mjs";
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
  /** uma imagem embutida, quando a mensagem carrega uma */
  imagem?: string | null;
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
   * O nível **cru**, sem o piso que o indicador de fala aplica.
   *
   * O indicador quer responder "esta pessoa está falando?" e por isso corta
   * embaixo. Regular a porta de ruído quer a pergunta oposta — "quanto barulho
   * tem quando ninguém fala?" — e a resposta mora justamente na parte que o
   * indicador joga fora.
   */
  meuNivel: number;
  /**
   * A minha captura de tela trouxe som?
   *
   * Vale a pena estar no estado, e não só num aviso no chat: é a diferença
   * entre a pessoa descobrir agora, olhando para a barra de telas, e descobrir
   * dez minutos depois pelo outro lado dizendo que o vídeo está mudo.
   */
  telaComSom: boolean;
  /**
   * Os microfones que este computador tem.
   *
   * Vazio até a permissão ser dada: antes dela `enumerateDevices` devolve a
   * lista com os rótulos em branco, e "Microfone 1, Microfone 2, Microfone 3"
   * não ajuda ninguém a escolher.
   */
  microfones: { id: string; nome: string }[];
  /** o escolhido; `null` é "o padrão do sistema" */
  microfoneId: string | null;
  /**
   * O que há de errado com a captura **agora**.
   *
   * Separado de `erro`: aquele é sobre entrar na sala, este é sobre o
   * microfone parar de funcionar no meio. Um defeito de áudio que não aparece
   * na tela é um defeito que a pessoa atribui a si mesma.
   */
  capturaAviso: string | null;
  /** o motor de áudio está preso pela política de autoplay do navegador */
  audioTravado: boolean;
  /**
   * O volume com que **eu** ouço cada pessoa, de 0 a 2. Ausente = 1.
   *
   * Vive só nesta sessão de propósito: o identificador de uma pessoa nasce
   * com a aba dela, então guardar entre visitas aplicaria o ajuste a quem
   * calhasse de receber o mesmo identificador depois. Um "silenciar" que
   * ressuscita na semana seguinte apontando para outra pessoa é pior que
   * refazer o ajuste.
   */
  volumes: Record<string, number>;
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
  /**
   * Mais de um endereço, separados por vírgula — e vale a pena usar isso.
   *
   * O mesmo TURN costuma atender em três portas, e elas não são
   * intercambiáveis: `turn:…:3478` é o caminho normal; `turn:…:443` passa por
   * firewall que só libera porta de web; e `turns:…:443` vai por TLS, que é o
   * único que atravessa rede corporativa com inspeção de tráfego. Anunciar os
   * três custa nada — o ICE testa todos em paralelo e fica com o que fechar
   * primeiro — e cobre redes que um só não cobriria.
   *
   *     NEXT_PUBLIC_TURN_URL=turn:casa:3478,turn:casa:443,turns:casa:443
   */
  const turn = (process.env.NEXT_PUBLIC_TURN_URL ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (turn.length > 0) {
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

  // ------------------------------------------------- avançado: microfone --

  /**
   * Cancelamento de eco.
   *
   * Desligar só faz sentido de fone: sem ele, o alto-falante volta para o
   * microfone e a sala vira microfonia em segundos. Em compensação ele é um
   * processador, e processador come agudo — para instrumento, desligado soa
   * bem melhor.
   */
  eco: boolean;
  /**
   * Controle automático de ganho.
   *
   * Nivela quem fala baixo e quem grita. O preço é que ele também levanta o
   * silêncio: numa sala com ruído de fundo, o ganho automático sobe o
   * ventilador junto quando ninguém está falando.
   */
  ganhoAuto: boolean;
  /** reforço de entrada em dB, aplicado depois da captura (-12 a +18) */
  ganho: number;
  /**
   * O ponto em que a porta de ruído abre.
   *
   * Era uma constante, e a documentação dela dizia que o limiar saía do nível
   * medido — o código comparava com um número fixo. Microfone fraco nunca
   * alcançava esse número, e a pessoa ficava muda com a supressão em `forte`.
   * Agora é ajustável, e o painel mostra o nível ao vivo ao lado para a
   * escolha ser feita olhando, não adivinhando.
   */
  limiar: number;
  /** taxa da voz em kbps; o Opus decide o resto */
  taxaVoz: number;
  /**
   * Corte de transmissão no silêncio.
   *
   * Economiza banda de verdade, e come o começo das palavras ditas baixinho.
   * Ligado só faz sentido em rede muito apertada.
   */
  dtx: boolean;

  // ----------------------------------------------- avançado: transmissão --

  /** teto de subida do vídeo em kbps; 0 = deixa a conta automática decidir */
  tetoVideo: number;
  /** mandar o som da captura junto com a imagem */
  somDaTela: boolean;
};

export const QUALIDADE_PADRAO: Qualidade = {
  audio: "voz",
  ruido: "padrao",
  resolucao: 1080,
  fps: 30,
  perfil: "nitidez",
  eco: true,
  ganhoAuto: true,
  ganho: 0,
  limiar: 0.035,
  taxaVoz: 96,
  dtx: false,
  tetoVideo: 0,
  somDaTela: true,
};

/**
 * Os dois modos prontos.
 *
 * `audio` deixou de mandar sozinho no processamento: agora ele é um atalho
 * que escreve os campos avançados de uma vez. Quem não quer pensar aperta
 * "Voz" ou "Música"; quem quer, mexe em cada um depois — e o que vale é
 * sempre o campo, nunca o atalho. Duas fontes de verdade para a mesma coisa
 * é como se produz uma tela que mostra "eco desligado" com o eco ligado.
 */
export const PREAJUSTES: Record<Qualidade["audio"], Partial<Qualidade>> = {
  voz: { eco: true, ganhoAuto: true, ruido: "padrao", taxaVoz: 96, dtx: false },
  musica: { eco: false, ganhoAuto: false, ruido: "desligado", taxaVoz: 256, dtx: false },
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
  // O teto escolhido à mão vale sobre o automático, e é dividido entre as
  // pessoas do mesmo jeito: quem sabe que tem 3 Mbps de subida põe 3000 aqui
  // e para de ver a chamada travar quando entra a quarta pessoa.
  const teto = q.tetoVideo > 0 ? q.tetoVideo * 1000 : TETO_SUBIDA;
  const cabe = teto / Math.max(1, pares);
  return Math.round(Math.min(alvo, cabe));
}

/** Taxa do Opus. O `musica` é estéreo, por isso o dobro largo. */
function bitrateAudio(q: Qualidade): number {
  // Entre 24 e 320 kbps: abaixo disso o Opus soa a telefone mesmo, e acima o
  // codec não usa o que sobra.
  return Math.round(Math.min(320, Math.max(24, q.taxaVoz))) * 1000;
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
  // Estéreo acompanha o número de canais que a captura pede, e a captura
  // segue o modo. Anunciar estéreo no SDP com uma faixa mono só desperdiça
  // taxa num canal silencioso.
  const estereo = q.audio === "musica";
  const chaves =
    `stereo=${estereo ? 1 : 0};sprop-stereo=${estereo ? 1 : 0};` +
    `maxaveragebitrate=${bitrateAudio(q)};maxplaybackrate=48000;` +
    `useinbandfec=1;usedtx=${q.dtx ? 1 : 0}`;

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

/**
 * Encolhe uma imagem até ela caber numa mensagem de chat.
 *
 * O teto não é estético, é do transporte: acima de `LIMITES.IMAGEM` a
 * mensagem não passa. Em vez de recusar o arquivo e mandar a pessoa abrir um
 * editor, a imagem é redesenhada menor e recomprimida até caber.
 *
 * A ordem importa. Primeiro cai a qualidade, que quase não se vê numa
 * captura de tela; só depois cai a dimensão, que é o que de fato torna texto
 * ilegível. Fazer o contrário entregaria uma imagem pequena e nítida onde se
 * queria uma grande e levemente suja — e quem manda captura de tela quer ler
 * o que está escrito nela.
 *
 * PNG vira JPEG no caminho: para captura de tela o PNG é várias vezes maior
 * pelo mesmo resultado visível. GIF passa intacto, porque recomprimir mataria
 * a animação, que costuma ser o motivo de alguém mandar um.
 */
async function reduzirImagem(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("isso não é uma imagem.");
  }

  const comoTexto = () =>
    new Promise<string>((ok, falha) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(String(leitor.result));
      leitor.onerror = () => falha(new Error("não consegui ler o arquivo."));
      leitor.readAsDataURL(arquivo);
    });

  // Animação não sobrevive ao `canvas`: um GIF redesenhado vira o primeiro
  // quadro dele. Ou cabe inteiro, ou não vai.
  if (arquivo.type === "image/gif") {
    const bruto = await comoTexto();
    if (bruto.length <= LIMITES.IMAGEM) return bruto;
    throw new Error("esse GIF é grande demais para o chat — o limite é cerca de 100 KB.");
  }

  const bruto = await comoTexto();
  if (bruto.length <= LIMITES.IMAGEM && arquivo.type !== "image/png") return bruto;

  const img = await new Promise<HTMLImageElement>((ok, falha) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => falha(new Error("não consegui abrir essa imagem."));
    i.src = bruto;
  });

  let largura = img.naturalWidth;
  let altura = img.naturalHeight;
  const encolher = (fator: number) => {
    largura = Math.max(1, Math.round(largura * fator));
    altura = Math.max(1, Math.round(altura * fator));
  };
  // Nenhuma tela de chat mostra mais que isto; começar acima é gastar bytes
  // em pixels que ninguém vê.
  const TETO = 1600;
  if (Math.max(largura, altura) > TETO) encolher(TETO / Math.max(largura, altura));

  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const ctx = tela.getContext("2d");
    if (!ctx) throw new Error("este navegador não deixou preparar a imagem.");
    ctx.drawImage(img, 0, 0, largura, altura);

    for (const q of [0.82, 0.7, 0.55, 0.42]) {
      const saida = tela.toDataURL("image/jpeg", q);
      if (saida.length <= LIMITES.IMAGEM) return saida;
    }
    // Nem na pior qualidade coube: agora sim vale perder tamanho.
    encolher(0.75);
  }

  throw new Error("essa imagem é grande demais para o chat, mesmo reduzida.");
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
  /**
   * Candidatos que chegaram antes da descrição remota.
   *
   * `addIceCandidate` antes do `setRemoteDescription` é erro em Chrome e em
   * Safari, e o `catch` silencioso de antes fazia o candidato **sumir**.
   * Perder um candidato é perder um caminho possível pelo NAT: sobra outro e a
   * chamada fecha, ou não sobra e ela fica muda. Depende de qual pacote chegou
   * primeiro — é a definição de defeito intermitente.
   */
  candidatosPendentes: RTCIceCandidateInit[];
  /**
   * Serializa a negociação deste par: uma operação de cada vez.
   *
   * Os sinais chegam de um `broadcast` que não espera o tratador anterior
   * terminar. Dois `setRemoteDescription` interpostos deixam a máquina de
   * estados num lugar que nenhum dos dois esperava, e a negociação morre em
   * silêncio.
   */
  fila: Promise<void>;
  medidor?: Medidor;

  // ------------------------------------------------- vigia deste par --

  /**
   * Quantos pacotes de áudio já chegaram desta pessoa, e desde quando esse
   * número parou de crescer.
   *
   * É a única pergunta que importa de verdade — "está entrando som?" — e a
   * única que nada mais neste arquivo sabia responder. `connectionState`
   * diz que o cano existe; `packetsReceived` diz que passa água por ele.
   */
  pacotes: number;
  /** quando o número parou de crescer; 0 = está crescendo */
  parouEm: number;
  /** já reiniciei o ICE por causa deste silêncio? */
  reiniciei: boolean;
  /** quantas vezes esta conexão já foi refeita do zero */
  refeita: number;
  /** desde quando está `disconnected`; 0 = não está */
  caiuEm: number;
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

/**
 * Os gestos que o Chrome aceita como "a pessoa quis".
 *
 * Mover o mouse não conta, e nem devia: a política existe para impedir que
 * uma página faça barulho sozinha. Clique, tecla e toque cobrem tudo o que
 * alguém faz numa sala de conversa.
 */
const GESTOS = ["pointerdown", "keydown", "touchend"] as const;

/**
 * O que ainda espera um gesto do usuário.
 *
 * Não é só o `AudioContext`. Cada `<audio>` que o navegador recusou tocar
 * está na mesma situação, e antes cada um tinha o seu próprio botão — "ouvir
 * fulano", um por pessoa. Numa sala de cinco isso é cinco cliques para ouvir
 * a conversa, e quem não clicar em todos vai jurar que fulano está mudo.
 *
 * Com a lista aqui, **um** gesto em qualquer lugar da página solta tudo de
 * uma vez: o motor de áudio e todas as reproduções pendentes.
 */
const pendencias = new Set<() => void>();
let ouvindoGestos = false;

/**
 * Espera um gesto para soltar o áudio.
 *
 * **O Chrome entrega o `AudioContext` suspenso.** A política de autoplay vale
 * para ele como vale para um `<audio>`, e a ativação do usuário **não
 * atravessa a navegação**: clicar "entrar" na página de fora não conta como
 * gesto no documento da sala. O `Som` aqui do lado já tratava isso para a
 * reprodução, com o botão "ouvir fulano" — o contexto ficou de fora.
 *
 * O estrago é caro e mudo, e é por isso que ele passou:
 *
 * - o medidor mede zero, então o anel de "está falando" nunca acende e a
 *   pessoa conclui que o microfone dela morreu;
 * - com a supressão em `forte`, a porta de ruído lê esse zero e fica fechada
 *   para sempre — aí não é só o anel, é a voz mesmo que não sai;
 * - compartilhando tela com som, a mistura sai de um `MediaStreamDestination`
 *   parado, que é silêncio digital puro.
 *
 * No Firefox nada disso aparece: ele deixa o contexto rodar. Daí o defeito
 * ser "não funciona no Chrome".
 *
 * `resume()` sem gesto não lança — fica pendente. Não dá para descobrir se
 * deu certo pelo `catch`; o que vale é o `state` depois.
 */
function tentarSoltar() {
  const c = contextoUnico;
  if (c && c.state !== "running") {
    void c.resume().catch(() => {
      /* ainda sem permissão: o próximo gesto tenta de novo */
    });
  }
  for (const f of [...pendencias]) {
    try {
      f();
    } catch {
      /* a próxima tentativa cuida */
    }
  }
}

/**
 * Fica ouvindo gestos **para sempre**, e isto é de propósito.
 *
 * A versão anterior soltava os tratadores assim que o contexto voltava a
 * rodar, e com isso tratava o bloqueio como um acidente que acontece uma vez.
 * Ele acontece muitas: o navegador suspende o contexto quando a aba dorme,
 * um `<audio>` novo nasce bloqueado a cada pessoa que entra, e um dispositivo
 * de saída que troca no meio pode parar a reprodução de novo. Três ouvintes
 * passivos custam nada perto de uma sala que emudece na segunda vez.
 */
function ligarGestos() {
  if (ouvindoGestos || typeof window === "undefined") return;
  ouvindoGestos = true;
  for (const ev of GESTOS) window.addEventListener(ev, tentarSoltar, { passive: true });
  // Voltar para a aba também é hora de tentar: o navegador suspende o
  // contexto quando ela perde o foco, e aí não há gesto nenhum a esperar.
  document.addEventListener("visibilitychange", tentarSoltar);
}

/**
 * Registra algo para ser tentado de novo no próximo gesto do usuário.
 *
 * Devolve como cancelar o registro — quem chama tem de cancelar ao
 * desmontar, senão a lista cresce com reproduções de elementos que já não
 * existem.
 */
export function aoPrimeiroGesto(f: () => void): () => void {
  pendencias.add(f);
  ligarGestos();
  return () => {
    pendencias.delete(f);
  };
}

function destravarAudio() {
  ligarGestos();
}

function contextoDeAudio(): AudioContext {
  if (!contextoUnico) contextoUnico = new AudioContext({ sampleRate: 48000 });
  if (contextoUnico.state === "suspended") {
    void contextoUnico.resume();
    // Se o `resume()` acima ficar pendente — que é o que acontece no Chrome
    // sem gesto —, isto garante que o primeiro clique na sala resolve.
    destravarAudio();
  }
  return contextoUnico;
}

/**
 * Amplifica o que chega de uma pessoa acima de 100%.
 *
 * O elemento `<audio>` só sabe **abaixar**: `volume` vai de 0 a 1 e não há
 * como pedir mais. Para subir é preciso passar o fluxo pelo motor de áudio,
 * e é o que isto faz — o elemento fica mudo e quem toca é o `GainNode`.
 *
 * O elemento continua ligado ao fluxo, e não é desperdício: em algumas versões
 * do Chrome um `MediaStream` de WebRTC só entrega áudio ao motor enquanto
 * estiver preso a um elemento de mídia. Soltá-lo silenciaria a pessoa
 * justamente ao tentar ouvi-la mais alto.
 */
export function criarReforco(fluxo: MediaStream) {
  const contexto = contextoDeAudio();
  const origem = contexto.createMediaStreamSource(fluxo);
  const ganho = contexto.createGain();
  origem.connect(ganho);
  ganho.connect(contexto.destination);
  return {
    ajustar(v: number) {
      // Rampa curta: mudar o ganho de um golpe estala, e o estalo é bem mais
      // desagradável que os dez milissegundos de transição.
      ganho.gain.setTargetAtTime(v, contexto.currentTime, 0.01);
    },
    parar() {
      try {
        origem.disconnect();
        ganho.disconnect();
      } catch {
        /* já desconectado */
      }
    },
  };
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
  ganhoDb = 0,
): Cadeia | null {
  const comSom = extras.filter((f): f is MediaStream => (f?.getAudioTracks().length ?? 0) > 0);
  if (!mic?.getAudioTracks().length && comSom.length === 0) return null;
  // Sem porta, sem reforço e sem som de tela não há o que fazer com o
  // microfone: a faixa crua vai direto, que é o que soa melhor e custa menos.
  if (!comPorta && comSom.length === 0 && ganhoDb === 0) return null;

  const contexto = contextoDeAudio();
  // A mistura sai daqui: com o contexto suspenso esta faixa é silêncio, e
  // ninguém ouviria nada sem um único erro no console.
  const destino = contexto.createMediaStreamDestination();
  const desfazer: (() => void)[] = [];
  let porta: GainNode | null = null;

  if (mic?.getAudioTracks().length) {
    const origem = contexto.createMediaStreamSource(mic);
    let ultimo: AudioNode = origem;

    if (ganhoDb !== 0) {
      /**
       * Reforço de entrada.
       *
       * Existe para o microfone que o sistema entrega baixo demais e não tem
       * onde subir — acontece com entrada de linha e com captura por HDMI. É
       * ganho linear, então **amplifica o ruído junto**: é remédio para sinal
       * fraco, não para sala barulhenta.
       *
       * O teto de +18 dB não é arbitrário: acima disso o que se ganha em
       * volume se perde em recorte, e o Opus passa a codificar distorção.
       */
      const reforco = contexto.createGain();
      reforco.gain.value = Math.pow(10, Math.min(18, Math.max(-12, ganhoDb)) / 20);
      ultimo.connect(reforco);
      ultimo = reforco;
      desfazer.push(() => reforco.disconnect());
    }

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

/**
 * A escolha de microfone mora no `localStorage`, e não no `sessionStorage`.
 *
 * O identificador do dispositivo é estável para a mesma origem enquanto a
 * permissão continuar dada, então guardar entre visitas funciona — e é o que
 * evita a pessoa reescolher o fone toda vez que entra numa sala. Quando o
 * identificador não vale mais, `abrirMicrofone` percebe e volta ao padrão.
 */
const CHAVE_MICROFONE = "nvdisc:microfone";
const CHAVE_QUALIDADE = "nvdisc:qualidade";

/**
 * As configurações duram entre visitas.
 *
 * Quem ajustou o limiar da porta olhando o medidor não quer refazer isso toda
 * vez que entra numa sala. Os campos são conferidos um a um na leitura: um
 * `localStorage` de outra versão do app, ou editado à mão, não pode injetar
 * um valor que o resto do código não espera.
 */
function qualidadeGuardada(): Qualidade {
  try {
    const bruto = localStorage.getItem(CHAVE_QUALIDADE);
    if (!bruto) return QUALIDADE_PADRAO;
    const lido = JSON.parse(bruto) as Partial<Qualidade>;
    const num = (v: unknown, min: number, max: number, padrao: number) =>
      typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao;
    const bool = (v: unknown, padrao: boolean) => (typeof v === "boolean" ? v : padrao);
    const um = <T,>(v: unknown, opcoes: readonly T[], padrao: T) =>
      opcoes.includes(v as T) ? (v as T) : padrao;

    return {
      audio: um(lido.audio, ["voz", "musica"] as const, QUALIDADE_PADRAO.audio),
      ruido: um(lido.ruido, ["desligado", "padrao", "forte"] as const, QUALIDADE_PADRAO.ruido),
      resolucao: um(lido.resolucao, [0, 720, 1080, 1440, 2160] as const, QUALIDADE_PADRAO.resolucao),
      fps: um(lido.fps, [30, 60] as const, QUALIDADE_PADRAO.fps),
      perfil: um(lido.perfil, ["nitidez", "movimento"] as const, QUALIDADE_PADRAO.perfil),
      eco: bool(lido.eco, QUALIDADE_PADRAO.eco),
      ganhoAuto: bool(lido.ganhoAuto, QUALIDADE_PADRAO.ganhoAuto),
      ganho: num(lido.ganho, -12, 18, QUALIDADE_PADRAO.ganho),
      limiar: num(lido.limiar, 0, 0.2, QUALIDADE_PADRAO.limiar),
      taxaVoz: num(lido.taxaVoz, 24, 320, QUALIDADE_PADRAO.taxaVoz),
      dtx: bool(lido.dtx, QUALIDADE_PADRAO.dtx),
      tetoVideo: num(lido.tetoVideo, 0, 50_000, QUALIDADE_PADRAO.tetoVideo),
      somDaTela: bool(lido.somDaTela, QUALIDADE_PADRAO.somDaTela),
    };
  } catch {
    return QUALIDADE_PADRAO;
  }
}

function guardarQualidade(q: Qualidade) {
  try {
    localStorage.setItem(CHAVE_QUALIDADE, JSON.stringify(q));
  } catch {
    /* sem onde guardar: vale por esta sessão */
  }
}

function microfoneGuardado(): string | null {
  try {
    return localStorage.getItem(CHAVE_MICROFONE) || null;
  } catch {
    // Navegação privativa e cookies bloqueados fazem o acesso **lançar**, não
    // devolver nulo. Sem este `catch` a sala inteira deixava de abrir.
    return null;
  }
}

function guardarMicrofone(id: string | null) {
  try {
    if (id) localStorage.setItem(CHAVE_MICROFONE, id);
    else localStorage.removeItem(CHAVE_MICROFONE);
  } catch {
    /* sem onde guardar: a escolha vale por esta sessão */
  }
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
  /** evita duas recuperações de captura ao mesmo tempo */
  private recuperando = false;
  /** desde quando a captura está em silêncio absoluto; 0 = não está */
  private mudaDesde = 0;
  /** já tentei reabrir por causa deste silêncio? */
  private tenteiRecuperar = false;
  /** o vigia de fluxo: confere de dois em dois segundos se entra som */
  private vigia?: ReturnType<typeof setInterval>;
  /** quando tentei abrir o microfone pela última vez estando sem nenhum */
  private ultimaTentativaMic = 0;
  /** já avisei que a conexão com esta pessoa não fecha? */
  private avisados = new Set<string>();
  /**
   * Por onde a voz pode passar.
   *
   * Começa com o que dá para saber sem perguntar a ninguém (o STUN embutido e
   * um TURN de senha fixa, se houver) e é substituído pela resposta de
   * `/api/turn` assim que ela chega. Nunca fica vazio: uma sala que espera
   * uma requisição para poder abrir é uma sala que não abre quando a
   * requisição falha.
   */
  private ice: RTCIceServer[] = servidores();

  private estado: EstadoMalha = {
    voceId: null,
    ligado: false,
    erro: null,
    participantes: [],
    mensagens: [],
    mudo: false,
    tela: false,
    microfones: [],
    microfoneId: null,
    capturaAviso: null,
    audioTravado: false,
    volumes: {},
    meuVolume: 0,
    meuNivel: 0,
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
    return this.idLocal() > outroId;
  }

  /**
   * O identificador desta aba, disponível desde `entrar()`.
   *
   * O `voceId` só existe depois do `BEMVINDO`, e usá-lo na conta de quem liga
   * abria uma janela em que o lado que deveria oferecer ainda calculava
   * `"" > outro` — falso. Como o outro lado calculava a mesma coisa e também
   * dava falso, **os dois se achavam quem atende**: nenhuma oferta era feita,
   * nenhuma seção de áudio existia, e a sala ficava muda com o chat impecável.
   *
   * Os dois transportes derivam o `voceId` justamente deste valor
   * (`sinalizacao.mjs`, `sinal-supabase.ts`), então usá-lo antes da resposta do
   * servidor não é um palpite: é o mesmo número, mais cedo.
   */
  private idLocal(): string {
    return this.estado.voceId ?? this.sessao ?? "";
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
    /**
     * Contexto parado é medidor medindo zero — e zero, para a porta, quer
     * dizer "ninguém está falando". Ela fecharia e ficaria fechada, que é
     * silêncio absoluto em vez de "abafa o ventilador".
     *
     * Enquanto ele não roda, a porta fica **aberta**. Deixar passar um ruído
     * de fundo é um defeito pequeno e audível; deixar de passar a voz é um
     * defeito grande e invisível, e entre os dois a escolha não é difícil.
     */
    if (contexto.state !== "running") {
      // Limpar o agendamento antes: uma transição marcada por
      // `setTargetAtTime` ainda pendente voltaria a fechar a porta assim que
      // o contexto retomasse.
      porta.gain.cancelScheduledValues(contexto.currentTime);
      porta.gain.value = this.estado.mudo ? 0 : 1;
      return;
    }
    const falando = nivelBruto(this.meuMedidor) > this.estado.qualidade.limiar;
    const alvo = falando && !this.estado.mudo ? 1 : 0;
    // `setTargetAtTime` faz a transição no próprio motor de áudio, sem
    // depender do relógio do JavaScript — que é justamente o que costuma
    // engasgar quando a página está ocupada.
    porta.gain.setTargetAtTime(alvo, contexto.currentTime, alvo === 1 ? 0.008 : 0.18);
  }

  private async refazerCadeia() {
    const q = this.estado.qualidade;
    const comPorta = q.ruido === "forte";
    this.cadeia?.desmontar();
    this.cadeia = montarCadeia(
      this.meuFluxo,
      [q.somDaTela ? this.fluxoTela : null],
      comPorta,
      q.ganho,
    );
    await this.trocarVoz();
  }

  /**
   * Troca a faixa de voz em todas as conexões abertas.
   *
   * Trocar a faixa não renegocia nada — mas **abrir a direção sim**, e é por
   * isso que o passo da direção está aqui. Um transceptor que nasceu
   * `recvonly` (quem atende sem microfone pronto) engole `replaceTrack` sem
   * reclamar e continua não mandando nada: o remetente tem faixa, a conexão
   * está `connected`, e o outro lado não ouve. Corrigir a direção dispara a
   * renegociação que faz a voz finalmente sair.
   *
   * Sem faixa nenhuma, o remetente é esvaziado em vez de ficar segurando uma
   * faixa morta — um microfone que acabou de ser desconectado continuaria
   * "enviando" silêncio, e o vigia de fluxo do outro lado leria isso como
   * conexão saudável.
   */
  private async trocarVoz() {
    const voz = this.vozParaEnviar();
    for (const par of this.pares.values()) {
      const canal = this.audioDe(par);
      if (!canal) continue;
      try {
        await canal.sender.replaceTrack(voz);
        if (voz && canal.transceptor && canal.transceptor.direction !== "sendrecv") {
          canal.transceptor.direction = "sendrecv";
        }
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
  private audioDe(par: Par): { sender: RTCRtpSender; transceptor: RTCRtpTransceiver | null } | null {
    for (const t of par.pc.getTransceivers()) {
      const ehAudio =
        t.sender.track?.kind === "audio" || t.receiver.track?.kind === "audio";
      if (ehAudio) {
        par.audioSender = t.sender;
        return { sender: t.sender, transceptor: t };
      }
    }
    // O transceptor não foi achado, mas o remetente guardado ainda serve para
    // trocar a faixa: é o que existe antes de a negociação pendurar o
    // receptor do outro lado.
    return par.audioSender ? { sender: par.audioSender, transceptor: null } : null;
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
    // Começa agora e é esperado lá embaixo: o navegador leva bem mais tempo
    // decidindo sobre o microfone do que o servidor leva para emitir uma
    // credencial, então em paralelo isto sai de graça.
    const ice = this.carregarIce();
    try {
      // O microfone é pedido **antes** de conectar. Se a permissão for negada,
      // é melhor descobrir agora do que depois de estar na sala mudo sem saber
      // por quê. `echoCancellation` e companhia importam mais aqui do que em
      // qualquer outro lugar: sem elas, dois na mesma casa viram microfonia.
      this.estado.microfoneId = microfoneGuardado();
      this.estado.qualidade = qualidadeGuardada();
      this.meuFluxo = await this.abrirMicrofone();
      this.meuMedidor = criarMedidor(this.meuFluxo);
      // Só agora, com a permissão dada, os dispositivos têm nome.
      this.vigiarCaptura();
      await this.listarMicrofones();
      navigator.mediaDevices?.addEventListener?.("devicechange", this.aoTrocarDispositivos);
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

    // As credenciais têm de estar prontas **antes** da primeira conexão: um
    // par criado com a lista velha ficaria sem TURN até alguém refazê-lo, e
    // essa pessoa é justamente a que mais precisa dele.
    await ice;
    this.abrirSinalizacao();
    this.laçoDeVolume();
    this.vigiarFluxos();
  }

  /**
   * Pergunta ao servidor por onde a voz pode passar.
   *
   * O TURN de verdade emite credencial de curta duração, e emiti-la exige um
   * segredo que não pode ir para o navegador — daí a resposta vir de uma rota
   * em vez de uma variável `NEXT_PUBLIC_`. Ver `src/app/api/turn/route.ts`.
   *
   * **Falhar aqui não pode impedir a sala de abrir.** Sem TURN a chamada
   * ainda fecha na maioria das redes, e trocar "algumas pessoas não são
   * ouvidas" por "ninguém entra" seria um péssimo negócio. Daí o prazo curto
   * e o silêncio no `catch`: o que sobra é a lista que já estava aqui.
   */
  private async carregarIce(): Promise<void> {
    try {
      const corte = AbortSignal.timeout(4000);
      const r = await fetch("/api/turn", { signal: corte, cache: "no-store" });
      if (!r.ok) return;
      const corpo = (await r.json()) as { iceServers?: RTCIceServer[]; aviso?: string };
      if (Array.isArray(corpo.iceServers) && corpo.iceServers.length > 0) {
        this.ice = corpo.iceServers;
      }
      // No console, e não no chat: é recado para quem hospeda, e ninguém numa
      // conversa precisa ler sobre configuração de servidor. Quem está na sala
      // só ouve falar disso se o áudio de fato não fechar — e aí o vigia de
      // fluxo diz, com o nome da pessoa e tudo.
      if (corpo.aviso) console.warn("NVDISC/TURN:", corpo.aviso);
    } catch {
      /* sem resposta: vale o que já estava na lista */
    }
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
      // `exact`, e não `ideal`: com `ideal` o navegador é livre para ignorar a
      // escolha em silêncio, que é exatamente o defeito que este seletor
      // existe para resolver. O preço — um microfone desconectado vira
      // `OverconstrainedError` — é pago em `abrirMicrofone`.
      ...(this.estado.microfoneId ? { deviceId: { exact: this.estado.microfoneId } } : {}),
      echoCancellation: q.eco,
      noiseSuppression: q.ruido !== "desligado",
      autoGainControl: q.ganhoAuto,
      sampleRate: 48000,
      // `sampleSize` saiu: o Chrome não implementa essa restrição, e pedir o
      // que o navegador não conhece só aumenta a chance de uma combinação
      // recusada sem explicação. O que ela pedia — 16 bits — é o que o
      // WebRTC usa de qualquer jeito.
      channelCount: musica ? 2 : 1,
    };
  }

  /**
   * Pede o microfone escolhido, e cai no padrão do sistema se ele sumiu.
   *
   * Um fone que foi desconectado desde a última visita deixaria a pessoa sem
   * áudio nenhum e com um erro que não explica nada. Melhor abrir no padrão e
   * seguir: a lista continua ali para ela escolher de novo.
   */
  private async abrirMicrofone(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: this.restricoesDeAudio(),
        video: false,
      });
    } catch (e) {
      if (!this.estado.microfoneId) throw e;
      this.estado.microfoneId = null;
      guardarMicrofone(null);
      return navigator.mediaDevices.getUserMedia({
        audio: this.restricoesDeAudio(),
        video: false,
      });
    }
  }

  /**
   * Fica de olho na faixa do microfone.
   *
   * Uma faixa viva não quer dizer uma faixa que capta. O Chrome marca
   * `muted` quando o sistema operacional silencia ou toma o dispositivo — um
   * programa que abre o microfone em modo exclusivo, o mixer do sistema, um
   * fone que troca de perfil. Nada disso lança erro, nada aparece no console,
   * e a faixa continua `live`: do lado de dentro parece tudo certo, e do lado
   * de fora é silêncio.
   *
   * `ended` é o dispositivo sumindo de vez — o fone desconectado.
   */
  private vigiarCaptura() {
    const faixa = this.meuFluxo?.getAudioTracks()[0];
    if (!faixa) return;

    faixa.onmute = () => {
      this.estado.capturaAviso =
        "o sistema silenciou este microfone — outro programa pode ter tomado " +
        "ele. Assim que soltar, volta sozinho.";
      this.avisar();
    };
    faixa.onunmute = () => {
      this.estado.capturaAviso = null;
      this.avisar();
    };
    faixa.onended = () => {
      // Desconectou. Reabrir cai no padrão do sistema se o escolhido sumiu.
      void this.recuperarCaptura();
    };
  }

  /**
   * Reabre a captura e entrega a faixa nova a quem já está na chamada.
   *
   * É a resposta a tudo que possa ter derrubado o microfone no meio: fone
   * desconectado, dispositivo tomado, captura que emudeceu sem avisar.
   * `refazerCadeia` termina em `replaceTrack`, então a troca não renegocia
   * nada — ninguém na sala percebe.
   */
  private async recuperarCaptura() {
    if (this.recuperando || this.fechando) return;
    // Nunca houve microfone (permissão negada, dispositivo tomado na entrada)
    // é diferente de ter perdido um: muda o que se pode dizer no fim.
    const tinha = !!this.meuFluxo;
    this.recuperando = true;
    try {
      const novo = await this.abrirMicrofone();
      novo.getAudioTracks().forEach((f) => (f.enabled = !this.estado.mudo));
      this.meuFluxo?.getTracks().forEach((f) => f.stop());
      this.meuFluxo = novo;
      this.meuMedidor?.parar();
      this.meuMedidor = criarMedidor(novo);
      this.vigiarCaptura();
      this.estado.capturaAviso = null;
      // Quem entrou sem microfone tem na tela o erro que explica isso. Ele
      // deixa de ser verdade no instante em que a captura abre, e um erro que
      // sobrevive à própria causa manda a pessoa recarregar uma página que já
      // está funcionando.
      if (!tinha) this.estado.erro = null;
      await this.refazerCadeia();
      await this.listarMicrofones();
      if (!tinha) this.sistema("o microfone abriu — pode falar.");
    } catch {
      // Sem microfone desde o começo, o vigia vai continuar tentando sozinho
      // e o erro de entrada já está na tela. Escrever "perdi o microfone" aqui
      // seria acusar uma perda que não houve, e piscando a cada cinco segundos.
      if (tinha) {
        this.estado.capturaAviso =
          "perdi o microfone e não consegui reabrir. Escolha outro na lista, " +
          "ou recarregue a página.";
      }
    } finally {
      this.recuperando = false;
      this.avisar();
    }
  }

  /** Ajusta o volume com que eu ouço uma pessoa. Nada é dito à sala. */
  definirVolumeDe(id: string, v: number) {
    const limpo = Math.min(2, Math.max(0, v));
    // Objeto novo: o React compara por identidade, e mexer por dentro não
    // faria a lista redesenhar.
    this.estado.volumes = { ...this.estado.volumes, [id]: limpo };
    this.avisar();
  }

  /** Destrava o motor de áudio. Vem de um clique, que é o que o Chrome exige. */
  async destravarSom() {
    try {
      await contextoDeAudio().resume();
    } catch {
      /* o próximo clique tenta de novo */
    }
    this.avisar();
  }

  /** Relê a lista de microfones do sistema. */
  private async listarMicrofones() {
    try {
      const todos = await navigator.mediaDevices.enumerateDevices();
      this.estado.microfones = todos
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({ id: d.deviceId, nome: d.label || `Microfone ${i + 1}` }));
      this.avisar();
    } catch {
      /* sem lista: o seletor some e o padrão do sistema continua valendo */
    }
  }

  /** Um fone que entra ou sai muda a lista — e às vezes o padrão do sistema. */
  private aoTrocarDispositivos = () => {
    void this.listarMicrofones();
  };

  /**
   * Troca o microfone com a chamada em andamento.
   *
   * Ninguém na sala percebe: a faixa nova entra por `replaceTrack` dentro de
   * `refazerCadeia`, e trocar a faixa de um remetente que já existe não
   * renegocia nada.
   */
  async definirMicrofone(id: string | null) {
    if (id === this.estado.microfoneId) return;
    const antes = this.estado.microfoneId;
    this.estado.microfoneId = id;
    try {
      const novo = await navigator.mediaDevices.getUserMedia({
        audio: this.restricoesDeAudio(),
        video: false,
      });
      novo.getAudioTracks().forEach((f) => (f.enabled = !this.estado.mudo));
      // A captura velha só é fechada depois de a nova existir: ao contrário,
      // um microfone que se recusa a abrir deixaria a pessoa muda.
      this.meuFluxo?.getTracks().forEach((f) => f.stop());
      this.meuFluxo = novo;
      this.meuMedidor?.parar();
      this.meuMedidor = criarMedidor(novo);
      this.vigiarCaptura();
      this.estado.erro = null;
      this.estado.capturaAviso = null;
      guardarMicrofone(id);
      await this.refazerCadeia();
    } catch {
      this.estado.microfoneId = antes;
      this.estado.erro =
        "não consegui abrir esse microfone — ele pode estar em uso por outro " +
        "programa. O anterior continua valendo.";
    }
    await this.listarMicrofones();
    this.avisar();
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
          msg.dados as {
            descricao?: RTCSessionDescriptionInit;
            candidato?: RTCIceCandidateInit;
            refazer?: boolean;
          },
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
            imagem: (msg.imagem as string | null) ?? null,
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
    if (existente) {
      /**
       * **Devolver o par que existe não basta.**
       *
       * Um sinal do outro lado pode ter criado este par como *quem atende*
       * antes de a lista de participantes chegar. Saindo aqui, o bloco de quem
       * liga nunca rodava e a conexão nascia sem seção de áudio nenhuma:
       * `connected`, chat perfeito, silêncio dos dois lados. Como tudo depende
       * de qual mensagem chegou primeiro, funcionava num dia e não no outro.
       *
       * `garantirEnvio` é idempotente — se os transceptores já estão lá, não
       * faz nada.
       */
      if (euLigo) await this.garantirEnvio(existente);
      return existente;
    }

    const pc = new RTCPeerConnection({ iceServers: this.ice });
    const par: Par = {
      pc,
      // O papel de "educado" sai da comparação dos identificadores: os dois
      // navegadores fazem a mesma conta e chegam a papéis opostos, sem
      // precisar combinar. É o que resolve o empate quando os dois propõem
      // mudança ao mesmo tempo.
      // Quem liga é o mal-educado, e quem atende cede. É o oposto do que
      // estava aqui, e importa: numa colisão o lado educado descarta a
      // **própria** oferta. Sendo ele quem atende, a oferta preservada é
      // sempre a de quem liga — a única que carrega os transceptores.
      //
      // O papel sai da **comparação dos identificadores**, e não do `euLigo`
      // que chegou por parâmetro. Os dois quase sempre coincidem, e o "quase"
      // era um defeito: quando um sinal cria o par antes de a lista de
      // participantes chegar, `abrirPar` recebe `euLigo = false` mesmo do
      // lado que liga — e aí os **dois** lados se achavam educados. Numa
      // colisão os dois cediam, cada um descartava a própria oferta, e a
      // negociação ficava dependendo de o acaso não juntar as duas. Pela
      // comparação, os papéis são sempre opostos, venha a chamada de onde vier.
      educado: !this.euLigoPara(outroId),
      fazendoOferta: false,
      ignorandoOferta: false,
      videoSender: null,
      audioSender: null,
      candidatosPendentes: [],
      fila: Promise.resolve(),
      pacotes: 0,
      parouEm: 0,
      reiniciei: false,
      refeita: 0,
      caiuEm: 0,
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
      /**
       * As faixas mortas saem junto.
       *
       * Uma conexão refeita entrega faixas novas, e as antigas ficariam no
       * fluxo — mortas, e **na frente**. Quem lê o fluxo lê a primeira faixa:
       * o medidor mediria zero para sempre, e o reforço de volume acima de
       * 100% tocaria silêncio. Duas maneiras diferentes de a pessoa sumir do
       * áudio sem nada falhar.
       */
      const juntar = (atual: MediaStream | undefined) =>
        new MediaStream([
          ...(atual?.getTracks() ?? []).filter(
            (t) => t.id !== ev.track.id && t.readyState === "live",
          ),
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

    // A oferta entra na **mesma fila** dos sinais que chegam. Solta, ela caía
    // no meio de um `setRemoteDescription` em andamento: o estado de
    // sinalização mudava sob os pés da operação, ela falhava, e o `catch`
    // engolia. Uma negociação perdida aqui é uma pessoa muda até alguém mexer
    // na qualidade — que por acaso refaz a cadeia e conserta. Daí o defeito
    // parecer aleatório.
    pc.onnegotiationneeded = () => {
      par.fila = par.fila.then(() => this.oferecer(par, outroId)).catch(() => {});
    };

    // Os transceptores são montados **agora**, depois de os tratadores
    // estarem no lugar: criá-los antes de existir `onnegotiationneeded`
    // dependia de o evento ser assíncrono para não se perder. Funcionava, mas
    // por sorte. Quem não liga simplesmente atende.
    if (euLigo) await this.garantirEnvio(par);
    return par;
  }

  /**
   * Assegura que este par tem por onde mandar voz e tela.
   *
   * Chamada só por quem liga, e mais de uma vez sem problema: cada seção é
   * criada uma vez só. É aqui que mora a garantia de que **sempre existe uma
   * seção de áudio**, com ou sem microfone pronto.
   */
  private async garantirEnvio(par: Par) {
    const { pc } = par;
    // `RTCRtpTransceiver` não tem `kind` no padrão — a faixa do receptor é o
    // caminho portátil, e ela existe assim que o transceptor existe.
    const jaTem = (tipo: "audio" | "video") =>
      pc.getTransceivers().some((t) => t.receiver.track?.kind === tipo);

    if (!jaTem("audio")) {
      /**
       * O transceptor de áudio nasce **sempre**, mesmo sem microfone.
       *
       * A versão anterior fazia `if (voz) addTrack(...)`: quem abrisse a sala
       * com o navegador ainda decidindo sobre o microfone ficava sem seção de
       * áudio, e sem volta — `replaceTrack` precisa de um remetente, e o
       * remetente nunca tinha nascido. Criando a seção vazia, o microfone que
       * chega atrasado entra por `trocarVoz()` sem renegociar nada.
       */
      const ta = pc.addTransceiver("audio", { direction: "sendrecv" });
      par.audioSender = ta.sender;
      const voz = this.vozParaEnviar();
      if (voz) await ta.sender.replaceTrack(voz);
    }

    if (!jaTem("video")) {
      // O transceptor de vídeo nasce vazio e fica pronto. Ver a nota no topo:
      // é isto que faz ligar a tela não renegociar nada.
      const tv = pc.addTransceiver("video", { direction: "sendrecv" });
      par.videoSender = tv.sender;
      const faixa = this.fluxoTela?.getVideoTracks()[0];
      if (faixa) await tv.sender.replaceTrack(faixa);
    }
  }

  /** Faz e manda uma oferta. Roda sempre dentro da fila do par. */
  private async oferecer(par: Par, outroId: string) {
    const { pc } = par;
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
  }

  /**
   * Negociação perfeita, do jeito que o padrão descreve.
   *
   * O trabalho de verdade vai para a fila do par: as mensagens chegam de um
   * `broadcast` que não espera ninguém, e duas descrições aplicadas ao mesmo
   * tempo se atrapalham.
   */
  private async sinalRecebido(
    de: string,
    dados: {
      descricao?: RTCSessionDescriptionInit;
      candidato?: RTCIceCandidateInit;
      refazer?: boolean;
    },
  ) {
    /**
     * O outro lado está refazendo esta conexão do zero.
     *
     * Sem este recado, quem refaz refaz **sozinho**: nasce com credenciais de
     * ICE e impressão de DTLS novas e manda uma oferta para um lado que ainda
     * acha a conexão dele perfeitamente boa — e do ponto de vista dele está,
     * porque o que quebrou foi o outro sentido. Aplicar essa oferta sobre uma
     * sessão viva pede ao navegador um aperto de mão que ele nem sempre
     * aceita, e o resultado é uma reconstrução que falha justamente quando é
     * mais necessária.
     *
     * Combinado, os dois jogam fora ao mesmo tempo e começam limpos. Quem
     * pediu é quem oferece; este lado só atende, e por isso não responde com
     * outro `refazer` — dois lados se pedindo reconstrução em resposta um ao
     * outro não teriam fim.
     */
    if (dados.refazer) {
      this.descartarPar(de);
      if (!this.fechando) await this.abrirPar(de, false);
      return;
    }
    const par = this.pares.get(de) ?? (await this.abrirPar(de, false));
    par.fila = par.fila.then(() => this.aplicarSinal(par, de, dados)).catch(() => {});
    await par.fila;
  }

  private async aplicarSinal(
    par: Par,
    de: string,
    dados: { descricao?: RTCSessionDescriptionInit; candidato?: RTCIceCandidateInit },
  ) {
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

        /**
         * Desfazer a própria oferta, à mão.
         *
         * Chrome e Firefox desfazem sozinhos quando chega uma oferta e já
         * existe uma local — o padrão manda. Safari só passou a fazer isso
         * tarde, e versões que ainda circulam simplesmente lançam
         * `InvalidStateError` aqui. Pedir o `rollback` explicitamente funciona
         * nos três, e nos que já desfariam sozinhos não custa nada.
         */
        if (ofertaConflitante && pc.signalingState === "have-local-offer") {
          try {
            await pc.setLocalDescription({ type: "rollback" });
          } catch {
            /* navegador que desfaz sozinho: o próximo passo cuida */
          }
        }

        await pc.setRemoteDescription(dados.descricao);
        // A descrição remota existe: os candidatos que estavam esperando já
        // têm onde encaixar.
        await this.escoarCandidatos(par);

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
        // Guardar em vez de perder. Ver a nota em `candidatosPendentes`: um
        // candidato descartado é um caminho de rede a menos, e às vezes era o
        // único que atravessava.
        if (!pc.remoteDescription) {
          par.candidatosPendentes.push(dados.candidato);
          return;
        }
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

  /** Entrega os candidatos que chegaram cedo demais. */
  private async escoarCandidatos(par: Par) {
    const guardados = par.candidatosPendentes.splice(0);
    for (const c of guardados) {
      try {
        await par.pc.addIceCandidate(c);
      } catch {
        /* candidato velho de uma negociação que já passou */
      }
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
      if (tipo === "audio") {
        par.audioSender = t.sender;
        if (!t.sender.track && mic) await t.sender.replaceTrack(mic);
        /**
         * A direção é aberta **mesmo sem microfone pronto**.
         *
         * Era condicionada a ter faixa, e essa condição custava a voz de quem
         * entrasse com o microfone ainda sendo decidido pelo navegador, ou
         * negado, ou tomado por outro programa. A resposta saía dizendo
         * `recvonly` — "eu só quero ouvir" —, e quando o microfone finalmente
         * abria, `replaceTrack` o pendurava num remetente que o padrão manda
         * ignorar. Ninguém ouvia essa pessoa pelo resto da chamada, sem um
         * erro em lugar nenhum.
         *
         * Aberta desde já, a faixa que chega depois entra por `trocarVoz` e
         * sai na hora.
         */
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
    this.avisados.delete(id);
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
    // Apertar "Voz" ou "Música" escreve os campos avançados de uma vez; mexer
    // num campo avançado depois vale sobre o atalho, porque ele vem por
    // último no espalhamento.
    const doPreajuste =
      q.audio !== undefined && q.audio !== antes.audio ? PREAJUSTES[q.audio] : {};
    const depois = { ...antes, ...doPreajuste, ...q };
    this.estado.qualidade = depois;
    guardarQualidade(depois);
    this.avisar();

    // O microfone só é repedido quando o que muda é ele: reabrir a captura à
    // toa corta o som de todo mundo por um instante.
    const mudouCaptura =
      depois.eco !== antes.eco ||
      depois.ganhoAuto !== antes.ganhoAuto ||
      depois.audio !== antes.audio ||
      // Só o `desligado` muda o que o navegador entrega; entre `padrao` e
      // `forte` o microfone é o mesmo, e o que muda é a porta — reabrir a
      // captura ali cortaria o som de todo mundo por nada.
      (depois.ruido === "desligado") !== (antes.ruido === "desligado");

    if (mudouCaptura) {
      try {
        const novo = await this.abrirMicrofone();
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

    // A porta, o reforço e o som da tela mudam o caminho do som sem tocar na
    // captura: refazer a cadeia troca a faixa por `replaceTrack` e ninguém na
    // sala ouve o corte.
    const mudouCadeia =
      depois.ruido !== antes.ruido ||
      depois.ganho !== antes.ganho ||
      depois.somDaTela !== antes.somDaTela;
    if (mudouCadeia && !mudouCaptura) {
      await this.refazerCadeia();
    }

    // Taxa da voz e DTX vivem no SDP, que só é escrito numa negociação nova.
    // Renegociar por causa disso é caro e visível; o teto de envio, que é
    // metade do efeito, vale na hora — e o resto entra na próxima oferta.
    if (depois.taxaVoz !== antes.taxaVoz || depois.tetoVideo !== antes.tetoVideo) {
      await this.aplicarQualidade();
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
        // O áudio da tela vai junto quando o navegador deixa — é o que faz
        // vídeo compartilhado ter som. Desligar é para quem vai mostrar algo
        // com som que os outros não precisam ouvir.
        video: this.restricoesDeTela(),
        audio: this.estado.qualidade.somDaTela,
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
      if (fluxo.getAudioTracks().length === 0 && this.estado.qualidade.somDaTela) {
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

  /**
   * Manda uma imagem para a sala.
   *
   * Ela vai **embutida na mensagem**, e não como arquivo: não há onde guardar
   * arquivo neste projeto, e não ter onde guardar é uma decisão, não uma
   * falta. O chat inteiro vive enquanto a sala existir e some junto com ela;
   * uma imagem que sobrevivesse à conversa seria a única coisa aqui que
   * deixa rastro.
   *
   * O preço é o tamanho: ela viaja pelo mesmo canal do chat, que tem teto.
   * `reduzirImagem` cuida disso antes de chegar aqui.
   */
  async enviarImagem(arquivo: File, legenda = "") {
    try {
      const imagem = await reduzirImagem(arquivo);
      this.manda(PARA_SERVIDOR.CHAT, { texto: legenda.trim(), imagem });
    } catch (e) {
      this.sistema(
        e instanceof Error && e.message
          ? e.message
          : "não consegui preparar essa imagem para enviar.",
      );
      this.avisar();
    }
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
      let mudou = this.conferirCaptura(agora);
      // Arredondar para um décimo corta a maior parte das atualizações: o
      // ruído de fundo oscila na terceira casa e não muda nada na tela.
      const passoDe = (v: number) => Math.round(v * 10) / 10;

      const meu = this.estado.mudo ? 0 : passoDe(nivel(this.meuMedidor));
      if (meu !== this.estado.meuVolume) {
        this.estado.meuVolume = meu;
        mudou = true;
      }
      // Duas casas: o bastante para a barrinha do painel se mexer com o
      // ruído de fundo, e pouco o bastante para não redesenhar a sala a cada
      // oscilação da terceira casa.
      const cru = Math.round(nivelBruto(this.meuMedidor) * 100) / 100;
      if (cru !== this.estado.meuNivel) {
        this.estado.meuNivel = cru;
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

  // --------------------------------------------------- o vigia de fluxo --

  /**
   * Confere, de dois em dois segundos, se **entra som de cada pessoa**.
   *
   * Todo o resto deste arquivo pergunta se a conexão existe. Existir e passar
   * áudio são coisas diferentes, e é entre as duas que mora quase todo
   * "às vezes funciona": uma negociação que terminou com uma seção de áudio
   * meia-boca, um caminho de rede que fechou e parou de passar, um lado que
   * ficou `recvonly` sem ninguém notar. Em todos, a sala fica bonita na tela
   * e muda no ouvido.
   *
   * A escada é de propósito, do barato ao caro: reiniciar o ICE resolve
   * caminho de rede sem derrubar nada; refazer a conexão resolve negociação
   * torta e custa um segundo de corte; falar com o usuário é o último passo,
   * quando as duas primeiras não deram jeito e o problema está fora do
   * alcance do código.
   */
  private vigiarFluxos() {
    if (this.vigia) clearInterval(this.vigia);
    this.vigia = setInterval(() => void this.conferirFluxos(), 2000);
  }

  /**
   * Quantos pacotes de áudio já chegaram nesta conexão.
   *
   * Serve como sinal de vida porque o WebRTC **não para de mandar quando a
   * pessoa fica muda**: uma faixa desligada vira silêncio codificado, e os
   * pacotes continuam chegando. Número parado, portanto, não quer dizer "sala
   * quieta" — quer dizer cano entupido.
   *
   * `-1` é "não deu para medir": navegador sem `getStats` utilizável, ou
   * conexão fechando. Quem chama trata como "não sei" e não como "parou".
   */
  private async pacotesDeAudio(pc: RTCPeerConnection): Promise<number> {
    try {
      const relatorio = await pc.getStats();
      let total = -1;
      relatorio.forEach((item) => {
        const s = item as { type?: string; kind?: string; packetsReceived?: number };
        if (s.type === "inbound-rtp" && s.kind === "audio") {
          total = Math.max(0, total) + (s.packetsReceived ?? 0);
        }
      });
      return total;
    } catch {
      return -1;
    }
  }

  private async conferirFluxos() {
    if (this.fechando) return;
    const agora = Date.now();

    /**
     * Sem microfone nenhum, tentar de novo.
     *
     * Quem negou a permissão e depois liberou, ou entrou com o fone tomado
     * por outro programa, ficava mudo **para sempre**: a recuperação de
     * captura só roda quando existe uma faixa para vigiar, e ali não existe
     * nenhuma. Uma tentativa a cada cinco segundos custa nada e é a diferença
     * entre "arrumei no navegador e voltou" e "tive de recarregar a página".
     */
    if (!this.meuFluxo && !this.recuperando && agora - this.ultimaTentativaMic > 5000) {
      this.ultimaTentativaMic = agora;
      void this.recuperarCaptura();
    }

    for (const [id, par] of [...this.pares.entries()]) {
      const estado = par.pc.connectionState;

      /**
       * `disconnected` é o estado ambíguo do WebRTC: pode voltar sozinho em
       * dois segundos, e pode ficar assim até o fim da chamada. Só o `failed`
       * tinha tratamento, e há redes em que a conexão nunca chega lá — ela
       * fica pendurada no meio, com a sala achando que ainda está tudo bem.
       */
      if (estado === "disconnected") {
        if (!par.caiuEm) par.caiuEm = agora;
        else if (agora - par.caiuEm > 4000) {
          par.caiuEm = agora; // uma tentativa a cada quatro segundos, não mais
          try {
            par.pc.restartIce();
          } catch {
            /* conexão já indo embora */
          }
        }
        continue;
      }
      par.caiuEm = 0;
      if (estado !== "connected") continue;

      const recebidos = await this.pacotesDeAudio(par.pc);
      if (recebidos < 0) continue;

      if (recebidos > par.pacotes) {
        par.pacotes = recebidos;
        par.parouEm = 0;
        par.reiniciei = false;
        // Voltou a entrar som: o aviso deixa de valer, e um novo silêncio
        // mais adiante merece ser dito de novo.
        this.avisados.delete(id);
        continue;
      }
      if (!par.parouEm) {
        par.parouEm = agora;
        continue;
      }

      const parado = agora - par.parouEm;

      // Primeiro degrau: o caminho de rede. Reiniciar o ICE procura outro sem
      // derrubar a conexão nem interromper quem já está ouvindo.
      if (parado > 6000 && !par.reiniciei) {
        par.reiniciei = true;
        try {
          par.pc.restartIce();
        } catch {
          /* segue para o degrau seguinte */
        }
        continue;
      }

      // Segundo degrau: a negociação. Refazer a conexão do zero é o que
      // conserta uma sessão que terminou sem seção de áudio de verdade — o
      // caso que nenhum reinício de ICE alcança, porque a rede está ótima e o
      // que está torto é o acordo.
      if (parado > 16000 && par.refeita < 2) {
        par.refeita += 1;
        await this.refazerPar(id);
        continue;
      }

      // Terceiro degrau: dizer. Duas reconstruções sem um pacote de áudio não
      // é mais defeito de código — é caminho de rede que não existe entre
      // estes dois navegadores, e quem resolve isso é um TURN.
      if (parado > 26000 && !this.avisados.has(id)) {
        this.avisados.add(id);
        const p = this.acha(id);
        this.sistema(
          `não está entrando som de ${p?.nome ?? "alguém"} — os dois navegadores ` +
            "se veem, mas o áudio não acha caminho entre as duas redes. É o caso " +
            "que precisa de um servidor TURN (ver o README).",
        );
        this.avisar();
      }
    }
  }

  /**
   * Refaz uma conexão do zero.
   *
   * Sempre no papel de **quem liga**, seja qual for o papel normal deste lado.
   * Uma conexão recém-nascida não tem transceptor nenhum, e quem só atende
   * fica esperando uma oferta que o outro lado não tem motivo para mandar —
   * ele acha que a conexão dele está ótima, e do ponto de vista dele está.
   * Quem refaz é quem oferece.
   *
   * O papel de educado continua saindo da comparação dos identificadores
   * dentro de `abrirPar`, então a regra de desempate segue valendo dos dois
   * lados.
   */
  private async refazerPar(id: string) {
    const antes = this.pares.get(id);
    const refeita = antes?.refeita ?? 1;
    // O recado vai **antes** de fechar: os dois transportes entregam na ordem
    // em que se manda, então ele chega na frente da oferta que vem logo a
    // seguir, e o outro lado já está limpo quando ela bate.
    this.manda(PARA_SERVIDOR.SINAL, { para: id, dados: { refazer: true } });
    this.descartarPar(id);
    if (this.fechando) return;
    const novo = await this.abrirPar(id, true);
    novo.refeita = refeita;
  }

  /**
   * Joga fora a conexão com alguém, e a mídia que veio por ela.
   *
   * A mídia sai junto de propósito. Deixá-la ali faria a pessoa aparecer com
   * som e vídeo congelados enquanto a conexão nova se refaz — e, pior, o
   * `<audio>` continuaria preso a um fluxo morto depois que a nova chegasse.
   */
  private descartarPar(id: string) {
    this.fecharPar(id);
    const p = this.acha(id);
    if (!p) return;
    p.audio = undefined;
    p.video = undefined;
    p.volume = 0;
    p.conexao = "aguardando";
    this.avisar();
  }

  /**
   * O microfone está mesmo captando?
   *
   * Todo o resto do código só sabe dizer se a faixa **existe**. Existir e
   * captar são coisas diferentes, e a distância entre as duas é exatamente
   * onde este defeito morava: contexto de áudio preso, dispositivo tomado
   * pelo sistema, entrada errada escolhida — em todos, a faixa está viva,
   * `readyState` é `live`, e o que sai é zero.
   *
   * Silêncio **absoluto** é o sinal. Uma sala vazia de madrugada ainda tem
   * ruído de fundo na terceira casa decimal; zero cravado por segundos
   * seguidos não é silêncio, é captura morta.
   *
   * Devolve se alguma coisa mudou na tela.
   */
  private conferirCaptura(agora: number): boolean {
    let mudou = false;

    // O motor de áudio, primeiro: enquanto ele não roda, o medidor mede zero
    // por conta dele, e acusar a captura seria acusar o inocente.
    const travado = !!contextoUnico && contextoUnico.state !== "running";
    if (travado !== this.estado.audioTravado) {
      this.estado.audioTravado = travado;
      mudou = true;
    }

    const faixa = this.meuFluxo?.getAudioTracks()[0];
    const podeMedir =
      !!faixa &&
      faixa.readyState === "live" &&
      !faixa.muted &&
      !this.estado.mudo &&
      !travado &&
      !this.recuperando;

    if (!podeMedir) {
      this.mudaDesde = 0;
      return mudou;
    }

    if (nivelBruto(this.meuMedidor) > 0.0005) {
      // Captou. Se havia aviso de silêncio, ele deixa de valer.
      this.mudaDesde = 0;
      this.tenteiRecuperar = false;
      if (this.estado.capturaAviso) {
        this.estado.capturaAviso = null;
        mudou = true;
      }
      return mudou;
    }

    if (this.mudaDesde === 0) {
      this.mudaDesde = agora;
      return mudou;
    }

    const parado = agora - this.mudaDesde;

    // Primeiro, tentar consertar sozinho: reabrir a captura resolve o
    // dispositivo que foi tomado e devolvido, que é o caso comum.
    if (parado > 5000 && !this.tenteiRecuperar) {
      this.tenteiRecuperar = true;
      void this.recuperarCaptura();
      return mudou;
    }

    // Reabriu e continua mudo: aí é escolha de dispositivo, e só a pessoa
    // resolve. Melhor dizer do que deixá-la achando que o microfone quebrou.
    if (parado > 13000 && !this.estado.capturaAviso) {
      const atual = this.estado.microfones.find((m) => m.id === this.estado.microfoneId);
      this.estado.capturaAviso =
        `não está entrando som por ${atual ? `"${atual.nome}"` : "este microfone"}. ` +
        "Escolha outra entrada em Qualidade → Microfone.";
      mudou = true;
    }

    return mudou;
  }

  sair() {
    this.fechando = true;
    // Avisa que a saída é de propósito: sem isto o servidor não tem como
    // distinguir "fechei a aba" de "a conexão caiu e já volto", e teria de
    // esperar a carência antes de tirar você da lista dos outros.
    this.manda(PARA_SERVIDOR.SAIR);
    cancelAnimationFrame(this.quadro);
    if (this.vigia) clearInterval(this.vigia);
    if (this.apurar) clearTimeout(this.apurar);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.religar) clearTimeout(this.religar);
    this.meuMedidor?.parar();
    this.cadeia?.desmontar();
    this.cadeia = null;
    for (const id of [...this.pares.keys()]) this.fecharPar(id);
    this.meuFluxo?.getTracks().forEach((f) => f.stop());
    this.fluxoTela?.getTracks().forEach((f) => f.stop());
    navigator.mediaDevices?.removeEventListener?.("devicechange", this.aoTrocarDispositivos);
    try {
      this.ws?.close();
      void this.supabase?.fechar();
    } catch {
      /* já fechado */
    }
  }
}
