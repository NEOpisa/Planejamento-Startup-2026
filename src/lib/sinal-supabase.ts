/**
 * A sinalização pelo Realtime do Supabase — sem servidor no meio.
 *
 * O NVDISC nasceu com um servidor próprio (`server.mjs`) que apresenta as
 * pessoas de uma sala umas às outras. Ele continua sendo a casa natural da
 * ferramenta. Mas quando as páginas moram numa hospedagem sem processo, esse
 * servidor não existe — e depender de WebSocket em função serverless provou
 * ser um chão instável: no nosso caso, a função recebia o upgrade, conseguia
 * **enviar** e nunca recebia um quadro sequer, sem erro em lugar nenhum.
 *
 * Aqui o navegador fala **direto** com o Realtime do Supabase, e some a
 * pergunta "onde roda o servidor da sala":
 *
 * - **presença** (`presence`) é a lista de quem está na sala. Ela já é o que
 *   o servidor fazia à mão: entra, sai, e todo mundo fica sabendo;
 * - **transmissão** (`broadcast`) leva o que é conversa entre dois: a
 *   negociação do WebRTC e o chat.
 *
 * O que **não** muda: as mensagens que chegam à [`Malha`] são as mesmas do
 * `protocolo.mjs`, na mesma forma. Este arquivo traduz um mundo no outro, e é
 * só por isso que o resto da sala não sabe — nem precisa saber — por onde a
 * conversa está sendo apresentada.
 *
 * A chave usada aqui é a **publicável**, que é feita para viver no navegador.
 * A secreta nunca chega perto disto.
 */

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

import { PARA_CLIENTE, LIMITES, limparImagem } from "./protocolo.mjs";

export type Publico = {
  id: string;
  nome: string;
  mudo: boolean;
  tela: boolean;
};

type Ganchos = {
  sala: string;
  nome: string;
  /** o identificador da aba: é ele que faz a reconexão não virar outra pessoa */
  sessao: string;
  recebeu: (msg: Record<string, unknown>) => void;
  ligou: () => void;
  caiu: () => void;
};

/** Onde o Supabase mora, do ponto de vista do navegador. */
export function configuracaoDoNavegador() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && chave ? { url, chave } : null;
}

export function criarSinalSupabase(
  { url, chave }: { url: string; chave: string },
  g: Ganchos,
) {
  const bd = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 30 } },
  });

  let canal: RealtimeChannel | null = null;
  let apresentado = false;
  let meuEstado = { mudo: false, tela: false };
  /** o que já foi contado à Malha, para não repetir nem perder mudança */
  let conhecidos = new Map<string, Publico>();
  let fechando = false;

  /** A lista de agora, tirada da presença do canal. */
  function roster(): Publico[] {
    const bruto = canal?.presenceState<Publico & { presence_ref: string }>() ?? {};
    const gente = new Map<string, Publico>();
    for (const entradas of Object.values(bruto)) {
      for (const e of entradas) {
        // A mesma aba pode aparecer duas vezes por um instante durante a
        // reconexão; a última vence, e o identificador é a aba, não a
        // conexão — então isso se resolve sozinho.
        gente.set(e.id, { id: e.id, nome: e.nome, mudo: e.mudo, tela: e.tela });
      }
    }
    return [...gente.values()];
  }

  /**
   * Traduz a lista da presença nas mensagens do protocolo.
   *
   * A presença entrega **o estado**, e a sala fala em **acontecimentos**
   * (entrou, saiu, mudou). A diferença entre a lista de antes e a de agora é
   * exatamente essa tradução.
   */
  function conciliar() {
    const agora = new Map(roster().map((p) => [p.id, p]));
    const eu = agora.get(g.sessao);
    const outros = [...agora.values()].filter((p) => p.id !== g.sessao);

    if (!apresentado) {
      // Cheguei: a lista inteira de uma vez, como o `bemvindo` do servidor.
      apresentado = true;
      g.ligou();
      g.recebeu({
        tipo: PARA_CLIENTE.BEMVINDO,
        voceId: g.sessao,
        sala: g.sala,
        participantes: outros,
      });
      conhecidos = agora;
      return;
    }

    for (const p of outros) {
      const antes = conhecidos.get(p.id);
      if (!antes) {
        g.recebeu({ tipo: PARA_CLIENTE.ENTROU, ...p });
        continue;
      }
      if (antes.mudo !== p.mudo || antes.tela !== p.tela) {
        g.recebeu({ tipo: PARA_CLIENTE.ESTADO, id: p.id, mudo: p.mudo, tela: p.tela });
      }
    }
    for (const [id] of conhecidos) {
      if (id !== g.sessao && !agora.has(id)) {
        g.recebeu({ tipo: PARA_CLIENTE.SAIU, id });
      }
    }
    // O meu próprio estado pode ter sido reenviado numa reconexão; guardo o
    // que a sala tem, para não sobrescrever com o que eu achava que era.
    if (eu) meuEstado = { mudo: eu.mudo, tela: eu.tela };
    conhecidos = agora;
  }

  async function anunciar() {
    await canal?.track({
      id: g.sessao,
      nome: g.nome,
      mudo: meuEstado.mudo,
      tela: meuEstado.tela,
    });
  }

  function abrir() {
    if (fechando) return;
    apresentado = false;
    conhecidos = new Map();

    const c = bd.channel(`nvdisc:${g.sala}`, {
      config: {
        // `self: true` porque o chat de quem escreveu tem de aparecer para
        // ele também, como acontecia com o servidor devolvendo a mensagem.
        broadcast: { self: true },
        presence: { key: g.sessao },
      },
    });
    canal = c;

    c.on("presence", { event: "sync" }, () => conciliar());
    c.on("presence", { event: "join" }, () => conciliar());
    c.on("presence", { event: "leave" }, () => conciliar());

    c.on("broadcast", { event: "sinal" }, ({ payload }) => {
      // Cada um recebe tudo e fica só com o que é seu. O endereçamento é do
      // conteúdo, não do transporte — como era com o servidor.
      if (payload?.para !== g.sessao) return;
      g.recebeu({ tipo: PARA_CLIENTE.SINAL, de: payload.de, dados: payload.dados });
    });

    c.on("broadcast", { event: "chat" }, ({ payload }) => {
      g.recebeu({
        tipo: PARA_CLIENTE.CHAT,
        de: payload.de,
        nome: payload.nome,
        texto: payload.texto,
        imagem: limparImagem(payload.imagem),
        em: payload.em,
      });
    });

    c.subscribe((estado) => {
      if (estado === "SUBSCRIBED") {
        const lotada = roster().filter((p) => p.id !== g.sessao).length >= LIMITES.POR_SALA;
        if (lotada) {
          g.recebeu({
            tipo: PARA_CLIENTE.ERRO,
            motivo:
              `esta sala já está com ${LIMITES.POR_SALA} pessoas, que é o limite. ` +
              `A conversa é direta entre os navegadores, e acima disso a conexão de ` +
              `quem tem internet mais fraca começa a sofrer.`,
          });
          void fechar();
          return;
        }
        void anunciar();
        return;
      }
      if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") {
        // O cliente do Supabase religa sozinho; aqui só se conta à sala que a
        // conexão está fora do ar, para o indicador do topo dizer a verdade.
        if (!fechando) g.caiu();
      }
    });
  }

  function manda(tipo: string, corpo: Record<string, unknown> = {}) {
    if (!canal) return;
    if (tipo === "sinal") {
      void canal.send({
        type: "broadcast",
        event: "sinal",
        payload: { de: g.sessao, para: corpo.para, dados: corpo.dados },
      });
      return;
    }
    if (tipo === "chat") {
      const texto = String(corpo.texto ?? "").slice(0, LIMITES.CHAT).trim();
      // Sem servidor no meio, a validação de quem recebe é a única que existe
      // — mas validar aqui também evita gastar o envio de um pacote que o
      // outro lado vai descartar.
      const imagem = limparImagem(corpo.imagem);
      if (!texto && !imagem) return;
      void canal.send({
        type: "broadcast",
        event: "chat",
        payload: { de: g.sessao, nome: g.nome, texto, imagem, em: Date.now() },
      });
      return;
    }
    if (tipo === "estado") {
      if (typeof corpo.mudo === "boolean") meuEstado.mudo = corpo.mudo;
      if (typeof corpo.tela === "boolean") meuEstado.tela = corpo.tela;
      void anunciar();
      return;
    }
    // `ping` não existe aqui: quem mantém a conexão de pé é o próprio cliente
    // do Supabase, e a presença já é o batimento.
  }

  async function fechar() {
    fechando = true;
    const c = canal;
    canal = null;
    if (!c) return;
    try {
      // Sair da presença antes de fechar: é o que faz a sua saída aparecer na
      // hora para os outros, em vez de esperar o tempo de expiração.
      await c.untrack();
      await bd.removeChannel(c);
    } catch {
      /* o canal já foi */
    }
  }

  return { abrir, manda, fechar };
}
