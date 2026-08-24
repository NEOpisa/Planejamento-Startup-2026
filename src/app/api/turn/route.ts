/**
 * Onde o navegador pergunta por onde a voz pode passar.
 *
 * O STUN só descobre o próprio endereço público, e isso basta na mesma rede e
 * na maioria das casas. O **TURN** retransmite quando não existe caminho
 * direto — NAT simétrico, internet de celular, o CGNAT que boa parte das
 * operadoras usa, rede de empresa. É a diferença exata entre "às vezes
 * funciona" e "funciona", e é o que a sala não tinha.
 *
 * Por que uma rota, e não uma variável `NEXT_PUBLIC_`
 * --------------------------------------------------
 * Serviço de TURN sério não trabalha com senha fixa: ele emite credenciais de
 * curta duração, e emiti-las exige um segredo que **não pode ir para o
 * navegador**. Uma `NEXT_PUBLIC_TURN_SENHA` é uma senha publicada no código
 * da página — qualquer um que abra a sala leva o relé de banda embora junto.
 *
 * Aqui o segredo fica no servidor, e o que sai é uma credencial que vale um
 * dia. O caminho antigo (`NEXT_PUBLIC_TURN_URL` e companhia) continua
 * funcionando para quem tem coturn próprio com senha fixa — ver o README.
 *
 * Aberto no navegador, este endereço também **se explica**: diz se está
 * configurado, com quem, e o que falta. A pergunta "será que pegou?" aparece
 * toda vez que isto sobe num lugar novo, e ela merece uma resposta que não
 * seja caçar linha de log.
 */

/** Sem processo Node não há como guardar segredo nenhum. */
export const runtime = "nodejs";
/**
 * Nunca em cache.
 *
 * As credenciais têm prazo. Uma resposta guardada pelo CDN entregaria, a quem
 * entrasse amanhã, uma credencial que venceu ontem — e o sintoma seria a sala
 * voltando a ficar muda sozinha, do nada, para algumas pessoas.
 */
export const dynamic = "force-dynamic";

/**
 * O STUN de sempre, que vale mesmo sem TURN nenhum configurado.
 *
 * Ele resolve a maior parte dos casos e não custa nada a ninguém. O que ele
 * **não** resolve é justamente o caso que traz alguém até este arquivo.
 */
const STUN: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

/** Quanto tempo a credencial emitida vale. Um dia cobre qualquer chamada. */
const VALIDADE = 86_400;

type Resposta = {
  iceServers: RTCIceServer[];
  /** de onde veio o TURN, para o diagnóstico poder dizer */
  fonte: "cloudflare" | "fixo" | "nenhum";
  aviso?: string;
};

/**
 * As credenciais do Cloudflare Realtime.
 *
 * A camada gratuita cobre 1 TB de relé por mês — para uma sala de amigos isso
 * é, na prática, ilimitado: uma conversa de duas pessoas relayada gasta algo
 * como 40 MB por hora.
 *
 * Os dois valores saem do painel (Realtime → TURN), e o token é secreto: sem
 * `NEXT_PUBLIC_`, ele nunca chega ao navegador.
 */
async function doCloudflare(): Promise<RTCIceServer[] | null> {
  const chave = process.env.TURN_KEY_ID;
  const token = process.env.TURN_KEY_API_TOKEN;
  if (!chave || !token) return null;

  const r = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(chave)}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: VALIDADE }),
    },
  );
  if (!r.ok) {
    throw new Error(
      `o Cloudflare recusou o pedido de credenciais (${r.status}). ` +
        "Confira TURN_KEY_ID e TURN_KEY_API_TOKEN no painel, em Realtime → TURN.",
    );
  }
  const corpo = (await r.json()) as { iceServers?: RTCIceServer[] | RTCIceServer };
  const lista = corpo.iceServers;
  if (!lista) throw new Error("o Cloudflare respondeu sem `iceServers`.");
  // A documentação mostra um array; versões da API já devolveram um objeto só.
  // Aceitar os dois custa uma linha e evita uma quebra silenciosa.
  return Array.isArray(lista) ? lista : [lista];
}

/**
 * O TURN de senha fixa — coturn próprio, ou serviço que ainda trabalhe assim.
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

async function montar(): Promise<Resposta> {
  try {
    const nuvem = await doCloudflare();
    if (nuvem) return { iceServers: [...STUN, ...nuvem], fonte: "cloudflare" };
  } catch (erro) {
    // Um TURN que não respondeu não pode derrubar a sala: sem ele a chamada
    // ainda fecha na maioria das redes. O que não pode é o defeito ficar
    // invisível — daí o aviso viajar junto com a resposta.
    return {
      iceServers: [...STUN, ...(fixo() ?? [])],
      fonte: fixo() ? "fixo" : "nenhum",
      aviso: String((erro as Error)?.message ?? erro),
    };
  }

  const proprio = fixo();
  if (proprio) return { iceServers: [...STUN, ...proprio], fonte: "fixo" };

  return {
    iceServers: STUN,
    fonte: "nenhum",
    aviso:
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
      credencial: resposta.iceServers.some((s) => s.username) ? "emitida" : "nenhuma",
      ...(resposta.aviso ? { aviso: resposta.aviso } : {}),
      comoResolver:
        resposta.fonte === "nenhum"
          ? "defina TURN_KEY_ID e TURN_KEY_API_TOKEN (Cloudflare Realtime → TURN), " +
            "ou TURN_URL/TURN_USER/TURN_SENHA se for um coturn próprio."
          : undefined,
    });
  }

  return Response.json(resposta, {
    headers: { "cache-control": "no-store" },
  });
}
