/**
 * O protocolo entre o navegador e o servidor de sinalização.
 *
 * Está em `.mjs` puro, e não em TypeScript, por um motivo prático: o
 * `server.mjs` roda em Node sem passar por compilação, e o cliente roda no
 * bundle do Next. Um arquivo só, importado pelos dois, é o que garante que os
 * dois falem exatamente a mesma língua — duas cópias das constantes seriam
 * duas chances de divergir num nome de campo e passar horas caçando um "por
 * que ninguém entra na sala".
 *
 * O que o servidor **faz**: entregar mensagem de um participante para outro, e
 * manter a lista de quem está em cada sala.
 *
 * O que o servidor **não faz**: tocar em áudio ou vídeo. A mídia vai direto de
 * um navegador para o outro (WebRTC em malha). É por isso que este servidor
 * cabe numa máquina modesta mesmo com gente conversando: por ele passa só o
 * texto da negociação e o chat.
 */

/** Cliente → servidor */
export const PARA_SERVIDOR = {
  /** {sala, nome, sessao} — pede para entrar */
  ENTRAR: "entrar",
  /** {para, dados} — repassa sinal de WebRTC a um participante */
  SINAL: "sinal",
  /** {texto, imagem?} — mensagem de chat para a sala inteira */
  CHAT: "chat",
  /** {mudo, tela} — o que mudou no meu estado */
  ESTADO: "estado",
  /** sem corpo — mantém a conexão viva atrás de proxies */
  PING: "ping",
  /**
   * sem corpo — "estou saindo de verdade"
   *
   * Fechar o socket não diz por quê: pode ser a pessoa fechando a aba ou a
   * hospedagem cortando a função no teto de duração. A primeira tem de sumir
   * da sala na hora; a segunda vai voltar em um segundo e não pode fazer os
   * outros derrubarem a chamada. Esta mensagem separa as duas.
   */
  SAIR: "sair",
};

/** Servidor → cliente */
export const PARA_CLIENTE = {
  /** {voceId, participantes:[{id,nome,mudo,tela}]} — resposta ao ENTRAR */
  BEMVINDO: "bemvindo",
  /** {id, nome, mudo, tela} — alguém chegou */
  ENTROU: "entrou",
  /** {id} — alguém saiu */
  SAIU: "saiu",
  /** {de, dados} — sinal de WebRTC vindo de um participante */
  SINAL: "sinal",
  /** {de, nome, texto, imagem?, em} — mensagem de chat */
  CHAT: "chat",
  /** {id, mudo, tela} — estado de alguém mudou */
  ESTADO: "estado",
  /** {motivo} — não deu para entrar */
  ERRO: "erro",
  PONG: "pong",
};

/** Limites. Existem porque a sala é pública: quem tiver o link entra. */
export const LIMITES = {
  /**
   * Malha completa: cada participante mantém uma conexão com cada um dos
   * outros, então o custo cresce ao quadrado. Oito é onde um computador comum
   * ainda dá conta com folga; acima disso seria preciso um servidor de mídia
   * (SFU), que é outro projeto.
   */
  POR_SALA: 8,
  NOME: 24,
  SALA: 32,
  SESSAO: 64,
  CHAT: 2000,
  /**
   * Tamanho máximo de uma imagem no chat, em caracteres da `data:` URL.
   *
   * O número sai do transporte, não do gosto: o Realtime do Supabase corta
   * mensagem acima de 256 KB, e a `data:` URL viaja dentro do mesmo pacote
   * que o resto do chat. 150 mil caracteres deixam folga confortável para o
   * envelope e ainda cabem numa captura de tela legível — o cliente reduz a
   * imagem até caber antes de mandar.
   *
   * Imagem não é arquivo: não há onde guardar, e ela vive só enquanto a sala
   * existir, como todo o resto do chat.
   */
  IMAGEM: 150_000,
  /** mensagens por janela de 10 s, por conexão */
  CHAT_RAJADA: 20,
};

/**
 * Deixa passar só imagem, e só embutida.
 *
 * Duas checagens, e as duas importam. O tipo tem de ser de imagem, senão a
 * mesma via serviria para mandar HTML ou SVG com script para dentro da sala
 * de todo mundo — SVG fica de fora justamente por isso: ele é um documento
 * que executa. E o esquema tem de ser `data:`, senão o que chega é um
 * endereço qualquer que o navegador de quem recebe vai buscar, entregando o
 * IP dele a quem escolheu o endereço.
 */
export function limparImagem(bruto) {
  const s = String(bruto ?? "");
  if (!s) return null;
  if (s.length > LIMITES.IMAGEM) return null;
  return /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : null;
}

/**
 * Tira de um nome o que não pode passar.
 *
 * Caracteres de controle saem: eles não aparecem na tela e servem para
 * embaralhar a lista de participantes de quem estiver lendo o chat num
 * terminal. O resto — acento, emoji, espaço — fica, porque nome é nome.
 */
export function limparNome(bruto) {
  return String(bruto ?? "")
    .replace(/\p{Cc}|\p{Cf}/gu, "")
    .trim()
    .slice(0, LIMITES.NOME);
}

/**
 * Normaliza o identificador da aba.
 *
 * Ele acompanha o `ENTRAR` para o servidor reconhecer **a mesma aba voltando**
 * — reconexão depois de queda de rede, ou o remonte que o React faz em
 * desenvolvimento. Sem ele, a conexão anterior continua na sala como uma
 * segunda pessoa com o seu nome, e o sintoma é ver "dois eu" ao entrar.
 *
 * Não é identidade nem sessão de login: nasce na aba, morre com ela, e o
 * servidor só o usa para comparar com quem já está na sala.
 */
export function limparSessao(bruto) {
  return String(bruto ?? "")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, LIMITES.SESSAO);
}

/**
 * Normaliza um código de sala.
 *
 * Minúsculas, e só letras, números e hífen: o código vai na URL e é ditado em
 * voz alta ("entra na sala churrasco"). Diferenciar maiúscula de minúscula
 * aqui criaria duas salas para quem quis uma, e o erro só apareceria como
 * "cadê todo mundo?".
 */
export function limparSala(bruto) {
  return String(bruto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITES.SALA);
}

/**
 * Um código curto e legível, para o botão "criar sala".
 *
 * Sílabas em vez de caracteres aleatórios: `kami-tone` se dita ao telefone,
 * `x7fQ2p` não. Vinte sílabas em quatro posições dão 160 mil combinações — de
 * sobra para um grupo de amigos, e o bastante para dois não colidirem.
 */
export function salaAleatoria() {
  const silabas = [
    "ka", "mi", "to", "ne", "va", "lu", "ra", "sol", "ze", "bo",
    "fi", "gua", "ja", "nu", "pe", "ta", "vi", "xo", "yu", "co",
  ];
  const n = () => silabas[Math.floor(Math.random() * silabas.length)];
  return `${n()}${n()}-${n()}${n()}`;
}
