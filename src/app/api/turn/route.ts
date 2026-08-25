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
 * Um TURN de senha fixa não vence, mas a resposta continua fora do cache de
 * propósito: o dia em que voltar a existir credencial com prazo, uma resposta
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
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

type Resposta = {
  iceServers: RTCIceServer[];
  /** de onde veio o TURN, para o diagnóstico poder dizer */
  fonte: "fixo" | "nenhum";
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

function montar(): Resposta {
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
  const resposta = montar();

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
          ? "defina TURN_URL, TURN_USER e TURN_SENHA apontando para um coturn próprio."
          : undefined,
    });
  }

  return Response.json(resposta, {
    headers: { "cache-control": "no-store" },
  });
}
