/**
 * As ferramentas da sala — o que se faz junto enquanto se conversa.
 *
 * Cinco coisas moram aqui: um quadro para desenhar, um bloco de notas, uma
 * fila de quem quer falar, uma enquete e um temporizador. Elas dividem o
 * mesmo canal de sinalização do chat (`Malha.mandarFerramenta`), e o
 * servidor não entende nenhuma delas — para ele é tudo carga opaca, do mesmo
 * jeito que o sinal do WebRTC. Acrescentar uma sexta ferramenta não encosta
 * no servidor.
 *
 * A regra da permissão
 * --------------------
 * Quadro e notas têm **dono**: quem abriu. Todo mundo na sala vê o que ele
 * faz, ao vivo, sem pedir nada a ninguém — ver é grátis, e um quadro que os
 * outros não enxergassem não teria por que ser compartilhado. **Mexer** é
 * que pede licença: quem quiser desenhar por cima manda um pedido, e o dono
 * libera ou não, uma pessoa de cada vez, podendo revogar depois.
 *
 * Isto não é segurança — a sala é pública, quem tem o código entra, e um
 * cliente modificado ignoraria a regra. É **etiqueta**: evita que o desenho
 * de alguém seja rabiscado por engano, que é o que acontece de verdade num
 * quadro aberto a oito pessoas. Onde há segurança de fato é na origem: `de`
 * é carimbado pelo servidor e nunca aceito do cliente, então ninguém
 * consegue anunciar uma permissão em nome do dono.
 *
 * As outras três não têm dono porque não fazia sentido ter: a mão levantada
 * é de quem a levanta, o voto é de quem vota, e o temporizador é um relógio
 * — trancá-lo daria mais discussão do que o problema que evitaria.
 *
 * Coordenadas
 * -----------
 * O quadro viaja em coordenadas de 0 a 1, não em pixels. A tela de cada um
 * tem um tamanho, e um traço em pixels desenhado num monitor de 27" chega
 * cortado pela metade num notebook — sem erro nenhum, o que é pior.
 */

import type { Malha, MsgFerramenta } from "./malha";

/** As cinco. O identificador viaja na mensagem, então é curto de propósito. */
export const FERRAMENTAS = ["quadro", "notas", "mao", "enquete", "tempo"] as const;
export type IdFerramenta = (typeof FERRAMENTAS)[number];

/** As que têm dono e pedem licença para mexer. */
const COM_DONO: IdFerramenta[] = ["quadro", "notas"];

/** O catálogo que o menu lê — título, descrição e a tecla de atalho. */
export const CATALOGO: {
  id: IdFerramenta;
  titulo: string;
  resumo: string;
  /** o que a ferramenta resolve, em uma linha, para o menu não virar adivinhação */
  para: string;
  dono: boolean;
}[] = [
  {
    id: "quadro",
    titulo: "Quadro",
    resumo: "Desenhar junto",
    para: "Explicar com um rabisco o que a palavra não alcança.",
    dono: true,
  },
  {
    id: "notas",
    titulo: "Notas",
    resumo: "Um texto para todos",
    para: "A ata da conversa, escrita enquanto ela acontece.",
    dono: true,
  },
  {
    id: "mao",
    titulo: "Fila de fala",
    resumo: "Levantar a mão",
    para: "Quatro pessoas falando por cima viram zero pessoas ouvindo.",
    dono: false,
  },
  {
    id: "enquete",
    titulo: "Enquete",
    resumo: "Decidir na hora",
    para: "Uma pergunta, as opções, e o resultado na tela de todos.",
    dono: false,
  },
  {
    id: "tempo",
    titulo: "Temporizador",
    resumo: "O mesmo relógio",
    para: "Pausa de café, rodada de fala, tempo de cada um.",
    dono: false,
  },
];

// ─────────────────────────────────────────────────────────── as mensagens ──

/** As ações do envelope. O que cada ferramenta faz vai dentro de `ato`. */
const ACAO = {
  /** "abri esta ferramenta e sou o dono dela" */
  ABRIR: "abrir",
  /** "fechei; ela não tem mais dono" */
  FECHAR: "fechar",
  /** "cheguei agora — quem é dono do quê, e como está?" */
  OI: "oi",
  /** resposta do dono a quem chegou: o retrato inteiro */
  RETRATO: "retrato",
  /** "posso mexer?" */
  PEDIR: "pedir",
  /** "pode" — vai para uma pessoa só */
  CONCEDER: "conceder",
  /** "não" — vai para uma pessoa só */
  NEGAR: "negar",
  /** "não pode mais" */
  REVOGAR: "revogar",
  /** uma ação dentro da ferramenta */
  ATO: "ato",
} as const;

// ────────────────────────────────────────────────────────────── os dados ──

/**
 * Um traço do quadro.
 *
 * Ele chega **em pedaços**: quem desenha manda um lote de pontos a cada 60 ms
 * com o mesmo `id`, e quem recebe vai emendando. É o que faz o traço aparecer
 * enquanto a mão anda, em vez de surgir pronto quando o dedo levanta — e a
 * diferença entre as duas coisas, numa conversa, é enorme: com o traço pronto
 * ninguém sabe se o outro está desenhando ou se travou.
 */
export type Traco = {
  id: string;
  de: string;
  cor: string;
  grossura: number;
  /** achatado: [x0, y0, x1, y1, …], tudo entre 0 e 1 */
  pontos: number[];
  /** o dedo já levantou? */
  fim: boolean;
};

export type Voto = { pergunta: string; opcoes: string[]; votos: Record<string, number> };

export type Mao = { id: string; nome: string; em: number };

export type EstadoFerramentas = {
  /** quem é dono de quê — `null` é "aberta a quem quiser pegar" */
  donos: Record<IdFerramenta, { id: string; nome: string } | null>;
  /** o que **eu** posso mexer, por ferramenta */
  posso: Record<IdFerramenta, boolean>;
  /** pedidos esperando a minha resposta, nas ferramentas que são minhas */
  pedidos: { f: IdFerramenta; de: string; nome: string; em: number }[];
  /** o que eu pedi e ainda não foi respondido */
  pedindo: Partial<Record<IdFerramenta, boolean>>;

  quadro: { tracos: Traco[] };
  notas: { texto: string; em: number; porNome: string };
  maos: Mao[];
  enquete: (Voto & { aberta: boolean; meuVoto: number | null }) | null;
  tempo: { rodando: boolean; restante: number; fimEm: number | null };
};

function vazio(): EstadoFerramentas {
  const nulos = {} as Record<IdFerramenta, { id: string; nome: string } | null>;
  const podes = {} as Record<IdFerramenta, boolean>;
  for (const f of FERRAMENTAS) {
    nulos[f] = null;
    // Sem dono, todo mundo pode: a ferramenta que ninguém pegou é de quem
    // chegar. A trava nasce junto com o dono, não antes dele.
    podes[f] = true;
  }
  return {
    donos: nulos,
    posso: podes,
    pedidos: [],
    pedindo: {},
    quadro: { tracos: [] },
    notas: { texto: "", em: 0, porNome: "" },
    maos: [],
    enquete: null,
    tempo: { rodando: false, restante: 0, fimEm: null },
  };
}

/** Como o `novoId` da malha, e pelo mesmo motivo: fora de HTTPS não há `randomUUID`. */
function id24(): string {
  try {
    if (typeof crypto?.randomUUID === "function") return crypto.randomUUID().slice(0, 18);
  } catch {
    /* contexto sem crypto */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ──────────────────────────────────────────────────────────────── a peça ──

/**
 * O estado das ferramentas de uma sala.
 *
 * Vive ao lado da `Malha` e não dentro dela de propósito: o estado da malha é
 * redesenhado a cada mudança, e o quadro muda dezenas de vezes por segundo.
 * Fundir os dois faria a lista de participantes e a grade de vídeos
 * repintarem a cada movimento do lápis.
 */
export class Ferramentas {
  private e = vazio();
  private malha: Malha;
  private eu = "";
  private meuNome = "";
  private ouvinte: (e: EstadoFerramentas) => void;

  /**
   * O traço que a minha mão está desenhando agora.
   *
   * Fica de fora do estado enquanto anda: ele muda a cada movimento do
   * ponteiro, e o desenho de quem desenha é pintado direto no canvas, sem
   * passar pelo React. O que vai para o estado é o traço fechado.
   */
  private meuTraco: Traco | null = null;
  private aEnviar: number[] = [];
  private timerEnvio: ReturnType<typeof setTimeout> | null = null;

  constructor(malha: Malha, ouvinte: (e: EstadoFerramentas) => void) {
    this.malha = malha;
    this.ouvinte = ouvinte;
    malha.aoFerramenta = (m) => this.receber(m);
  }

  estado() {
    return this.e;
  }

  private avisar() {
    // Cópia rasa: o React compara referência, e mutar em silêncio é a receita
    // de "o estado está certo e a tela não muda".
    this.e = { ...this.e };
    this.ouvinte(this.e);
  }

  /**
   * Quem eu sou nesta sala.
   *
   * Só dá para saber depois do `bemvindo`, e é por isso que não vem no
   * construtor: a `Malha` é criada antes de entrar.
   */
  souEu(id: string, nome: string) {
    const mudou = this.eu !== id;
    this.eu = id;
    this.meuNome = nome;
    // Cheguei: pergunto quem é dono do quê. Quem for responde com o retrato,
    // e é assim que entrar numa conversa em andamento mostra o quadro que já
    // estava lá em vez de uma folha em branco.
    if (mudou && id) this.malha.mandarFerramenta("*", ACAO.OI);
  }

  /**
   * A sala mudou de gente.
   *
   * Dono que saiu é dono que não volta: a ferramenta fica sem dono e livre
   * para o próximo pegar. O **conteúdo fica** — apagar o quadro porque quem
   * o abriu caiu da chamada seria punir a sala pela internet de uma pessoa.
   */
  sincronizar(presentes: string[]) {
    const vivos = new Set(presentes);
    let mudou = false;
    for (const f of FERRAMENTAS) {
      const d = this.e.donos[f];
      if (d && !vivos.has(d.id)) {
        this.e.donos[f] = null;
        this.e.posso[f] = true;
        mudou = true;
      }
    }
    const maos = this.e.maos.filter((m) => vivos.has(m.id));
    if (maos.length !== this.e.maos.length) {
      this.e.maos = maos;
      mudou = true;
    }
    const pedidos = this.e.pedidos.filter((p) => vivos.has(p.de));
    if (pedidos.length !== this.e.pedidos.length) {
      this.e.pedidos = pedidos;
      mudou = true;
    }
    if (mudou) this.avisar();
  }

  // ───────────────────────────────────────────────── dono e permissão ──

  private souDono(f: IdFerramenta) {
    return this.e.donos[f]?.id === this.eu;
  }

  /** Pega uma ferramenta que não tem dono. */
  abrir(f: IdFerramenta) {
    if (!COM_DONO.includes(f) || this.e.donos[f]) return;
    this.e.donos[f] = { id: this.eu, nome: this.meuNome };
    this.e.posso[f] = true;
    this.malha.mandarFerramenta(f, ACAO.ABRIR);
    this.avisar();
  }

  /** Larga uma ferramenta que é minha. */
  fechar(f: IdFerramenta) {
    if (!this.souDono(f)) return;
    this.e.donos[f] = null;
    this.e.posso[f] = true;
    this.e.pedidos = this.e.pedidos.filter((p) => p.f !== f);
    this.malha.mandarFerramenta(f, ACAO.FECHAR);
    this.avisar();
  }

  pedir(f: IdFerramenta) {
    if (this.e.posso[f] || this.e.pedindo[f]) return;
    this.e.pedindo = { ...this.e.pedindo, [f]: true };
    this.malha.mandarFerramenta(f, ACAO.PEDIR, null, this.e.donos[f]?.id ?? "");
    this.avisar();
  }

  responder(f: IdFerramenta, quem: string, sim: boolean) {
    if (!this.souDono(f)) return;
    this.e.pedidos = this.e.pedidos.filter((p) => !(p.f === f && p.de === quem));
    this.malha.mandarFerramenta(f, sim ? ACAO.CONCEDER : ACAO.NEGAR, null, quem);
    // Quem foi liberado precisa do retrato: pode ter chegado depois do
    // último traço, e desenhar sobre um quadro que não é o que os outros
    // veem produz duas telas diferentes com o mesmo nome.
    if (sim) this.enviarRetrato(f, quem);
    this.avisar();
  }

  revogar(f: IdFerramenta, quem: string) {
    if (!this.souDono(f)) return;
    this.malha.mandarFerramenta(f, ACAO.REVOGAR, null, quem);
  }

  // ─────────────────────────────────────────────────────────── o quadro ──

  /** Começa um traço. `x` e `y` já vêm de 0 a 1. */
  comecarTraco(x: number, y: number, cor: string, grossura: number) {
    if (!this.e.posso.quadro) return null;
    this.meuTraco = { id: id24(), de: this.eu, cor, grossura, pontos: [x, y], fim: false };
    this.aEnviar = [x, y];
    this.e.quadro.tracos = [...this.e.quadro.tracos, this.meuTraco];
    this.agendarEnvio();
    return this.meuTraco;
  }

  seguirTraco(x: number, y: number) {
    if (!this.meuTraco) return;
    this.meuTraco.pontos.push(x, y);
    this.aEnviar.push(x, y);
    this.agendarEnvio();
  }

  terminarTraco() {
    if (!this.meuTraco) return;
    this.meuTraco.fim = true;
    this.despachar(true);
    this.meuTraco = null;
    this.avisar();
  }

  /**
   * Um lote a cada 60 ms, e não um pacote por ponto.
   *
   * Um ponteiro entrega até 240 eventos por segundo em tela boa. Mandar um a
   * um estouraria o teto de rajada em três segundos de rabisco, e o traço
   * apareceria truncado no outro lado sem erro nenhum. Sessenta milissegundos
   * dão ~17 pacotes por segundo, que a mão não distingue de tempo real.
   */
  private agendarEnvio() {
    if (this.timerEnvio) return;
    this.timerEnvio = setTimeout(() => this.despachar(false), 60);
  }

  private despachar(fim: boolean) {
    if (this.timerEnvio) {
      clearTimeout(this.timerEnvio);
      this.timerEnvio = null;
    }
    const t = this.meuTraco;
    if (!t) return;
    if (this.aEnviar.length === 0 && !fim) return;
    this.malha.mandarFerramenta("quadro", ACAO.ATO, {
      k: "traco",
      id: t.id,
      cor: t.cor,
      grossura: t.grossura,
      // Arredondar em quatro casas corta o pacote quase pela metade e é mais
      // precisão do que qualquer tela tem: 1/10000 de uma tela de 4K é meio
      // pixel.
      p: this.aEnviar.map((n) => Math.round(n * 10000) / 10000),
      fim,
    });
    this.aEnviar = [];
  }

  /** Apaga o último traço **meu**. Ninguém desfaz o traço do outro. */
  desfazer() {
    if (!this.e.posso.quadro) return;
    const meus = this.e.quadro.tracos.filter((t) => t.de === this.eu);
    const ultimo = meus[meus.length - 1];
    if (!ultimo) return;
    this.e.quadro.tracos = this.e.quadro.tracos.filter((t) => t.id !== ultimo.id);
    this.malha.mandarFerramenta("quadro", ACAO.ATO, { k: "apagar", id: ultimo.id });
    this.avisar();
  }

  /** Limpa tudo — só o dono, porque apaga o trabalho dos outros junto. */
  limparQuadro() {
    if (!this.souDono("quadro") && this.e.donos.quadro) return;
    this.e.quadro.tracos = [];
    this.malha.mandarFerramenta("quadro", ACAO.ATO, { k: "limpar" });
    this.avisar();
  }

  // ──────────────────────────────────────────────────────────── as notas ──

  escreverNotas(texto: string) {
    if (!this.e.posso.notas) return;
    const em = Date.now();
    this.e.notas = { texto, em, porNome: this.meuNome };
    this.malha.mandarFerramenta("notas", ACAO.ATO, { k: "texto", texto: texto.slice(0, 4000), em });
    this.avisar();
  }

  // ───────────────────────────────────────────────────────────── a fila ──

  /**
   * Levanta ou abaixa a minha mão.
   *
   * A fila é por ordem de chegada, e o carimbo é o de **quem levantou**, não
   * o de quem recebeu: com o carimbo do recebedor, duas pessoas veriam a fila
   * em ordens diferentes conforme a latência de cada uma — e discutiriam
   * sobre de quem era a vez.
   */
  mao(levantada: boolean) {
    const em = Date.now();
    const outras = this.e.maos.filter((m) => m.id !== this.eu);
    this.e.maos = levantada
      ? [...outras, { id: this.eu, nome: this.meuNome, em }].sort((a, b) => a.em - b.em)
      : outras;
    this.malha.mandarFerramenta("mao", ACAO.ATO, { k: "mao", levantada, em });
    this.avisar();
  }

  // ─────────────────────────────────────────────────────────── a enquete ──

  abrirEnquete(pergunta: string, opcoes: string[]) {
    const limpas = opcoes.map((o) => o.trim()).filter(Boolean).slice(0, 6);
    if (!pergunta.trim() || limpas.length < 2) return;
    this.e.donos.enquete = { id: this.eu, nome: this.meuNome };
    this.e.enquete = { pergunta: pergunta.trim(), opcoes: limpas, votos: {}, aberta: true, meuVoto: null };
    this.malha.mandarFerramenta("enquete", ACAO.ATO, {
      k: "nova",
      pergunta: pergunta.trim(),
      opcoes: limpas,
    });
    this.avisar();
  }

  votar(i: number) {
    const q = this.e.enquete;
    if (!q || !q.aberta || i < 0 || i >= q.opcoes.length) return;
    // Trocar o voto é permitido, e por isso o placar guarda **por pessoa** em
    // vez de somar: com contador, mudar de ideia somaria dois.
    this.e.enquete = { ...q, votos: { ...q.votos, [this.eu]: i }, meuVoto: i };
    this.malha.mandarFerramenta("enquete", ACAO.ATO, { k: "voto", i });
    this.avisar();
  }

  encerrarEnquete() {
    const q = this.e.enquete;
    if (!q || this.e.donos.enquete?.id !== this.eu) return;
    this.e.enquete = { ...q, aberta: false };
    this.malha.mandarFerramenta("enquete", ACAO.ATO, { k: "encerrar" });
    this.avisar();
  }

  // ─────────────────────────────────────────────────────── temporizador ──

  /**
   * O tempo viaja como **quanto falta**, e não como o instante em que acaba.
   *
   * Os relógios de duas máquinas divergem em segundos, às vezes em minutos, e
   * um instante absoluto chegaria ao outro lado já vencido — o temporizador
   * apareceria zerado na tela de quem tem o relógio adiantado. Com a duração,
   * cada um conta a partir do momento em que recebeu, e a diferença fica
   * sendo só a latência da rede.
   */
  iniciarTempo(segundos: number) {
    const s = Math.max(1, Math.min(3600, Math.round(segundos)));
    this.e.tempo = { rodando: true, restante: s, fimEm: Date.now() + s * 1000 };
    this.malha.mandarFerramenta("tempo", ACAO.ATO, { k: "iniciar", s });
    this.avisar();
  }

  pausarTempo() {
    const t = this.e.tempo;
    if (!t.rodando || !t.fimEm) return;
    const resta = Math.max(0, Math.round((t.fimEm - Date.now()) / 1000));
    this.e.tempo = { rodando: false, restante: resta, fimEm: null };
    this.malha.mandarFerramenta("tempo", ACAO.ATO, { k: "pausar", s: resta });
    this.avisar();
  }

  zerarTempo() {
    this.e.tempo = { rodando: false, restante: 0, fimEm: null };
    this.malha.mandarFerramenta("tempo", ACAO.ATO, { k: "zerar" });
    this.avisar();
  }

  // ─────────────────────────────────────────────────────────── recepção ──

  private enviarRetrato(f: IdFerramenta | "*", para: string) {
    const manda = (qual: IdFerramenta, dados: unknown) =>
      this.malha.mandarFerramenta(qual, ACAO.RETRATO, dados, para);

    if ((f === "*" || f === "quadro") && this.souDono("quadro")) {
      // O quadro pode ser grande. Vai em lotes de 40 traços para não estourar
      // o teto de tamanho da mensagem — que cortaria o retrato inteiro, e o
      // sintoma seria alguém entrar e ver um quadro em branco que todos os
      // outros veem cheio.
      const t = this.e.quadro.tracos;
      for (let i = 0; i < t.length; i += 40) manda("quadro", { k: "tracos", t: t.slice(i, i + 40) });
      if (t.length === 0) manda("quadro", { k: "tracos", t: [] });
    }
    if ((f === "*" || f === "notas") && this.souDono("notas")) {
      manda("notas", { k: "texto", texto: this.e.notas.texto, em: this.e.notas.em });
    }
    if (f === "*") {
      // A enquete e o tempo não têm dono, então quem responde é quem tiver o
      // que contar. Vários responderem é inofensivo: o conteúdo é o mesmo.
      if (this.e.enquete) {
        manda("enquete", {
          k: "estado",
          pergunta: this.e.enquete.pergunta,
          opcoes: this.e.enquete.opcoes,
          votos: this.e.enquete.votos,
          aberta: this.e.enquete.aberta,
        });
      }
      const t = this.e.tempo;
      if (t.rodando && t.fimEm) {
        manda("tempo", { k: "iniciar", s: Math.max(0, Math.round((t.fimEm - Date.now()) / 1000)) });
      }
      const minha = this.e.maos.find((m) => m.id === this.eu);
      if (minha) manda("mao", { k: "mao", levantada: true, em: minha.em });
    }
  }

  private receber(m: MsgFerramenta) {
    // Eco de mim mesmo não se aplica duas vezes. O transporte do Supabase
    // devolve o que a gente manda (`self: true`, que o chat precisa), e um
    // traço aplicado em dobro faria o desfazer apagar metade.
    if (m.de === this.eu) return;

    const f = m.f as IdFerramenta;

    if (m.a === ACAO.OI) {
      this.enviarRetrato("*", m.de);
      // Quem já tem dono se reanuncia: assim quem chegou sabe a quem pedir,
      // mesmo nas ferramentas cujo retrato está vazio.
      for (const q of COM_DONO) {
        if (this.souDono(q)) this.malha.mandarFerramenta(q, ACAO.ABRIR, null, m.de);
      }
      return;
    }

    if (m.a === ACAO.ABRIR && COM_DONO.includes(f)) {
      // Quem chegou primeiro fica. Dois abrindo no mesmo instante é raro, e a
      // regra precisa ser a mesma nas duas telas — "o primeiro que anunciou"
      // é a única que as duas conseguem aplicar sem se falar.
      if (!this.e.donos[f]) {
        this.e.donos[f] = { id: m.de, nome: m.nome };
        this.e.posso[f] = false;
        this.avisar();
      }
      return;
    }

    if (m.a === ACAO.FECHAR && COM_DONO.includes(f)) {
      if (this.e.donos[f]?.id === m.de) {
        this.e.donos[f] = null;
        this.e.posso[f] = true;
        this.e.pedindo = { ...this.e.pedindo, [f]: false };
        this.avisar();
      }
      return;
    }

    if (m.a === ACAO.PEDIR) {
      if (!this.souDono(f)) return;
      if (this.e.pedidos.some((p) => p.f === f && p.de === m.de)) return;
      this.e.pedidos = [...this.e.pedidos, { f, de: m.de, nome: m.nome, em: m.em }];
      this.avisar();
      return;
    }

    if (m.a === ACAO.CONCEDER || m.a === ACAO.NEGAR || m.a === ACAO.REVOGAR) {
      // Só o dono manda nisto. Sem esta linha, qualquer um na sala se
      // autoconcederia permissão mandando um "conceder" para si mesmo.
      if (this.e.donos[f]?.id !== m.de) return;
      this.e.posso[f] = m.a === ACAO.CONCEDER;
      this.e.pedindo = { ...this.e.pedindo, [f]: false };
      this.avisar();
      return;
    }

    if (m.a === ACAO.RETRATO || m.a === ACAO.ATO) {
      this.aplicar(f, m, m.a === ACAO.RETRATO);
      return;
    }
  }

  /** O conteúdo de cada ferramenta. */
  private aplicar(f: IdFerramenta, m: MsgFerramenta, retrato: boolean) {
    const d = (m.dados ?? {}) as Record<string, unknown>;
    const k = String(d.k ?? "");

    if (f === "quadro") {
      if (k === "tracos") {
        const chegando = (d.t as Traco[]) ?? [];
        // Emenda em vez de troca: o retrato vem em lotes, e o segundo lote
        // não pode apagar o primeiro.
        const tenho = new Set(this.e.quadro.tracos.map((t) => t.id));
        const novos = chegando.filter((t) => t && !tenho.has(t.id));
        if (retrato && chegando.length === 0 && this.e.quadro.tracos.length === 0) return;
        this.e.quadro.tracos = [...this.e.quadro.tracos, ...novos];
        this.avisar();
        return;
      }
      if (k === "traco") {
        const tid = String(d.id ?? "");
        const p = (d.p as number[]) ?? [];
        const atual = this.e.quadro.tracos.find((t) => t.id === tid);
        if (atual) {
          atual.pontos = [...atual.pontos, ...p];
          atual.fim = Boolean(d.fim);
        } else {
          this.e.quadro.tracos = [
            ...this.e.quadro.tracos,
            {
              id: tid,
              de: m.de,
              cor: String(d.cor ?? "#6495ed"),
              grossura: Number(d.grossura ?? 3),
              pontos: p,
              fim: Boolean(d.fim),
            },
          ];
        }
        this.avisar();
        return;
      }
      if (k === "apagar") {
        // Só apaga o que é de quem mandou.
        this.e.quadro.tracos = this.e.quadro.tracos.filter(
          (t) => !(t.id === String(d.id ?? "") && t.de === m.de),
        );
        this.avisar();
        return;
      }
      if (k === "limpar") {
        if (this.e.donos.quadro && this.e.donos.quadro.id !== m.de) return;
        this.e.quadro.tracos = [];
        this.avisar();
        return;
      }
      return;
    }

    if (f === "notas" && k === "texto") {
      const em = Number(d.em ?? m.em);
      // O mais recente vence. Duas pessoas digitando ao mesmo tempo no mesmo
      // parágrafo se atrapalham — é a natureza de um texto sem fusão de
      // edições, e é justamente por isso que as notas têm dono.
      if (em < this.e.notas.em) return;
      this.e.notas = { texto: String(d.texto ?? ""), em, porNome: m.nome };
      this.avisar();
      return;
    }

    if (f === "mao" && k === "mao") {
      const outras = this.e.maos.filter((x) => x.id !== m.de);
      this.e.maos = d.levantada
        ? [...outras, { id: m.de, nome: m.nome, em: Number(d.em ?? m.em) }].sort((a, b) => a.em - b.em)
        : outras;
      this.avisar();
      return;
    }

    if (f === "enquete") {
      if (k === "nova" || k === "estado") {
        this.e.donos.enquete = { id: m.de, nome: m.nome };
        const votos = (d.votos as Record<string, number>) ?? {};
        this.e.enquete = {
          pergunta: String(d.pergunta ?? ""),
          opcoes: ((d.opcoes as string[]) ?? []).slice(0, 6),
          votos,
          aberta: k === "nova" ? true : Boolean(d.aberta),
          meuVoto: votos[this.eu] ?? null,
        };
        this.avisar();
        return;
      }
      const q = this.e.enquete;
      if (!q) return;
      if (k === "voto") {
        this.e.enquete = { ...q, votos: { ...q.votos, [m.de]: Number(d.i ?? 0) } };
        this.avisar();
        return;
      }
      if (k === "encerrar" && this.e.donos.enquete?.id === m.de) {
        this.e.enquete = { ...q, aberta: false };
        this.avisar();
      }
      return;
    }

    if (f === "tempo") {
      const s = Math.max(0, Math.min(3600, Number(d.s ?? 0)));
      if (k === "iniciar") this.e.tempo = { rodando: true, restante: s, fimEm: Date.now() + s * 1000 };
      else if (k === "pausar") this.e.tempo = { rodando: false, restante: s, fimEm: null };
      else if (k === "zerar") this.e.tempo = { rodando: false, restante: 0, fimEm: null };
      else return;
      this.avisar();
    }
  }

  encerrar() {
    if (this.timerEnvio) clearTimeout(this.timerEnvio);
    this.malha.aoFerramenta = null;
  }
}
