/**
 * Onde o navegador pergunta por onde a voz pode passar.
 *
 * O STUN só descobre o próprio endereço público, e isso basta na mesma rede e
 * na maioria das casas. O **TURN** retransmite quando não existe caminho
 * direto — NAT simétrico, internet de celular, o CGNAT que boa parte das
 * operadoras usa, rede de empresa. É a diferença exata entre "às vezes
 * funciona" e "funciona".
 *
 * Por que uma rota, e não uma variável `NEXT_PUBLIC_`
 * --------------------------------------------------
 * Uma `NEXT_PUBLIC_TURN_SENHA` é uma senha publicada no código da página —
 * qualquer um que abra a sala leva o relé de banda embora junto. Aqui o
 * segredo fica no servidor, e o caminho antigo (`NEXT_PUBLIC_TURN_URL` e
 * companhia) continua funcionando para quem já o tinha.
 *
 * Aberto no navegador, este endereço também **se explica**: diz se está
 * configurado, com quê, e o que falta. A pergunta "será que pegou?" aparece
 * toda vez que isto sobe num lugar novo, e ela merece uma resposta que não
 * seja caçar linha de log.
 */

/** Sem processo Node não há como guardar segredo nenhum. */
export const runtime = "nodejs";
/**
 * Nunca em cache.
 *
 * A credencial do Cloudflare vence: uma resposta
 * guardada pelo CDN entregaria a quem entrasse amanhã uma credencial vencida
 * ontem — e o sintoma seria a sala ficando muda sozinha, para algumas pessoas.
 */
export const dynamic = "force-dynamic";

/**
 * O STUN de sempre, que vale mesmo sem TURN nenhum configurado.
 *
 * Ele resolve a maior parte dos casos e não custa nada a ninguém. O que ele
 * **não** resolve é justamente o caso que traz alguém até este arquivo.
 */
const STUN: RTCIceServer[] = [
  {
    // Quatro operadores independentes, e não quatro endereços do mesmo: o
    // ponto é que a queda de um não leve a sala junto. Esta lista sobrescreve
    // a do navegador assim que a resposta chega, então ela precisa continuar
    // igual à de `servidores()` em `src/lib/malha.ts` — duas listas que
    // divergem viram um defeito que só aparece em produção.
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun.nextcloud.com:443",
      "stun:stun.sipgate.net:3478",
    ],
  },
];

type Resposta = {
  iceServers: RTCIceServer[];
  /** de onde veio o TURN, para o diagnóstico poder dizer */
  fonte: "cloudflare" | "fixo" | "nenhum";
  aviso?: string;
};

/**
 * O TURN de senha fixa — um coturn próprio, ou serviço que trabalhe assim.
 *
 * Vários endereços separados por vírgula, e vale usar mais de um: `3478` é o
 * caminho normal, `443` passa por firewall que só libera porta de web, e
 * `turns:` vai por TLS, que é o único que atravessa rede com inspeção de
 * tráfego. O ICE testa todos em paralelo e fica com o primeiro que fechar.
 *
 * Lê as variáveis sem `NEXT_PUBLIC_` primeiro: uma senha que fica no servidor
 * é melhor que a mesma senha embutida na página, e quem já tinha o arranjo
 * antigo continua funcionando sem mexer em nada.
 */
function fixo(): RTCIceServer[] | null {
  const bruto = process.env.TURN_URL ?? process.env.NEXT_PUBLIC_TURN_URL ?? "";
  const urls = bruto
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (urls.length === 0) return null;
  return [
    {
      urls,
      username: process.env.TURN_USER ?? process.env.NEXT_PUBLIC_TURN_USER,
      credential: process.env.TURN_SENHA ?? process.env.NEXT_PUBLIC_TURN_SENHA,
    },
  ];
}

/**
 * As credenciais do Cloudflare Realtime TURN (1 TB/mês grátis).
 *
 * A credencial vence, então é pedida a cada sessão com o segredo que fica só
 * no servidor. Endereços na porta 53 saem da lista: o Chrome e o Firefox os
 * bloqueiam e o ICE perde tempo esperando um caminho que nunca abre.
 */
/**
 * A credencial vale 24 h e serve para qualquer um: guardada aqui, a entrada na
 * sala não espera uma ida ao Cloudflare a cada vez — só quando a instância é
 * nova ou a credencial passou da metade da vida. Metade, e não o fim, porque
 * quem a recebe agora ainda precisa de horas de chamada com ela.
 */
const TTL = 86400;
let guardada: { servidores: RTCIceServer[]; renovarEm: number } | null = null;
let pedindo: Promise<RTCIceServer[] | null> | null = null;

async function doCloudflare(): Promise<RTCIceServer[] | null> {
  if (!process.env.TURN_KEY_ID || !process.env.TURN_KEY_API_TOKEN) return null;
  if (guardada && Date.now() < guardada.renovarEm) return guardada.servidores;
  // Várias entradas ao mesmo tempo dividem o mesmo pedido.
  pedindo ??= pedirAoCloudflare().finally(() => {
    pedindo = null;
  });
  return pedindo;
}

async function pedirAoCloudflare(): Promise<RTCIceServer[] | null> {
  const chave = process.env.TURN_KEY_ID!;
  const token = process.env.TURN_KEY_API_TOKEN!;

  const r = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(chave)}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: TTL }),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    },
  );
  if (!r.ok) {
    throw new Error(
      `o Cloudflare recusou o pedido de credenciais (${r.status}). ` +
        "Confira TURN_KEY_ID e TURN_KEY_API_TOKEN em Realtime → TURN Server.",
    );
  }
  const corpo = (await r.json()) as { iceServers?: RTCIceServer[] | RTCIceServer };
  const bruta = corpo.iceServers;
  if (!bruta) throw new Error("o Cloudflare respondeu sem `iceServers`.");
  // A documentação mostra um array; versões da API já devolveram um objeto só.
  const lista = Array.isArray(bruta) ? bruta : [bruta];

  const servidores = lista
    .map((s) => {
      const urls = (typeof s.urls === "string" ? [s.urls] : [...s.urls]).filter(
        (u) => !/:53(\?|$)/.test(u),
      );
      return { ...s, urls };
    })
    .filter((s) => s.urls.length > 0);
  guardada = { servidores, renovarEm: Date.now() + (TTL / 2) * 1000 };
  return servidores;
}

async function montar(): Promise<Resposta> {
  let aviso: string | undefined;
  try {
    const nuvem = await doCloudflare();
    if (nuvem && nuvem.length > 0) {
      return { iceServers: [...STUN, ...nuvem], fonte: "cloudflare" };
    }
  } catch (erro) {
    // Um TURN que não respondeu não pode derrubar a sala: cai para o fixo ou
    // só STUN, e o motivo vai para o log e para o diagnóstico.
    aviso = erro instanceof Error ? erro.message : String(erro);
    console.error("NVDISC/TURN:", aviso);
  }

  const proprio = fixo();
  if (proprio) return { iceServers: [...STUN, ...proprio], fonte: "fixo", aviso };

  return {
    iceServers: STUN,
    fonte: "nenhum",
    aviso:
      aviso ??
      "sem TURN configurado: quem estiver atrás de NAT simétrico (celular, " +
        "CGNAT, rede de empresa) pode entrar na sala e não ser ouvido. Veja " +
        '"Antes de chamar a turma" no README.',
  };
}

export async function GET(requisicao: Request) {
  const resposta = await montar();

  // `?diagnostico` responde a pergunta que se faz de verdade — **isto vai
  // funcionar?** — sem despejar credenciais boas em qualquer aba aberta por
  // curiosidade.
  if (new URL(requisicao.url).searchParams.has("diagnostico")) {
    return Response.json({
      turn: resposta.fonte,
      servidores: resposta.iceServers.flatMap((s) =>
        typeof s.urls === "string" ? [s.urls] : [...s.urls],
      ),
      credencial: resposta.iceServers.some((s) => s.username) ? "definida" : "nenhuma",
      ...(resposta.aviso ? { aviso: resposta.aviso } : {}),
      comoResolver:
        resposta.fonte === "nenhum"
          ? "defina TURN_KEY_ID e TURN_KEY_API_TOKEN (Cloudflare Realtime → TURN Server), " +
            "ou TURN_URL/TURN_USER/TURN_SENHA para um coturn próprio."
          : undefined,
    });
  }

  return Response.json(resposta, {
    headers: { "cache-control": "no-store" },
  });
}
