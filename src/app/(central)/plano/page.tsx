import React from "react";
import Link from "next/link";

import Foot from "@/components/shell/Foot";
import { ArrowUpRight } from "@/components/icons";

/**
 * PLANO — o caminho até o primeiro cliente pago.
 *
 * O documento é longo de propósito, então ele é lido como o resto da central:
 * um painel por assunto, título grande, prosa em coluna estreita. Nada de
 * estilo próprio aqui — as peças (painel, cartão, lista, número) vêm do
 * sistema do NVGHUB, em `globals.css`.
 */

/* ---------- dados ---------- */
const CHIPS: [string, string][] = [
  ["rede", "zero"],
  ["tempo", "<10h/semana"],
  ["verba", "R$ 0"],
  ["portfólio", "nenhum ainda"],
];

const PREP: [string, string, string][] = [
  ["Uma demo de prova", "um site-conceito de clínica no nosso template, que substitui o portfólio que não temos.", "~4h"],
  ["Lista de 40 prospects", "só os com presença ruim (sem site / feio / só linktree).", "~2h"],
  ["Roteiros", "abordagem + o passo a passo do vídeo de SCAN.", "~2h"],
  ["Definir a oferta de fundador", "o que damos aos 2-3 primeiros em troca de depoimento + case.", "~1h"],
];

const BUDGET: [string, number, string][] = [
  ["Prospecção", 83, "~5h"],
  ["Conversas + follow-up", 50, "~3h"],
  ["Ajustar a mensagem", 17, "~1h"],
];

const SCRIPTS: { title: string; body: string }[] = [
  {
    title: "1 · Primeiro contato (DM Instagram)",
    body: "Oi [nome]! Vi a [clínica] aqui em [cidade] — o trabalho de vocês em [procedimento] tá muito bom. Uma coisa me saltou aos olhos: [problema concreto]. Gravei um vídeo de 2 min mostrando o que eu faria pra transformar essas visitas em agendamento. Quer que eu te mande? Sem compromisso nenhum.",
  },
  {
    title: "2 · Entrega o SCAN e puxa a call",
    body: "Te mandei o vídeo aqui. Nele eu mostro 3 pontos rápidos. Se fizer sentido, tenho 20 min essa semana pra te mostrar o blueprint completo — quinta 15h ou sexta 10h?",
  },
  {
    title: "3 · Oferta de fundador (na call)",
    body: "Vou ser transparente: estamos selecionando [2 clínicas da cidade] pra serem nossos primeiros cases aqui. Pra esses dois, fazemos o projeto com condição de fundador — [desconto/condição] em troca de um depoimento e de podermos usar como portfólio. Você seria um deles. Fecha essa semana?",
  },
];

const STATS: [string, string][] = [
  ["R$ 0", "custo de aquisição — só tempo e capricho"],
  ["4–8", "semanas até o primeiro cliente pago"],
  ["~13", "abordagens por semana, depois da Semana 0"],
  ["~1", "call marcada por semana de prospecção"],
];

const FAVOR: [string, string][] = [
  ["Calculadora de precificação", " — orçamento em segundos e mini-CRM dos prospects."],
  ["neovanguard.com.br e o sistema visual da casa", " — prova viva de que sabemos fazer."],
  ["10 kits por segmento", " prontos (clínica, restaurante, imobiliária, advocacia…) — escopo e preço na hora."],
  ["O método SCAN → Blueprint → Solução → Flow", " — que agora vira também a nossa abordagem."],
];

const DECISIONS: [string, string][] = [
  ["Nicho de partida", " — topa estética/odonto, ou você vê um caminho mais fácil pela nossa cidade/rede?"],
  ["Oferta de fundador", " — quanto estamos dispostos a dar nos 2-3 primeiros em troca de case?"],
  ["Divisão", " — quem prospecta e quem entrega? Com <10h cada, precisa estar claro."],
  ["Meta de data", " — cravar uma data-alvo pro primeiro contrato assinado nos dá urgência."],
];

/* placeholders entre [colchetes] viram texto suave */
function withPlaceholders(text: string): React.ReactNode {
  return text.split(/(\[[^\]]+\])/g).map((seg, i) =>
    seg.startsWith("[") && seg.endsWith("]") ? (
      <em key={i}>{seg.slice(1, -1)}</em>
    ) : (
      <React.Fragment key={i}>{seg}</React.Fragment>
    ),
  );
}

function Secao({
  id,
  eyebrow,
  titulo,
  destaque,
  children,
}: {
  id: string;
  eyebrow: string;
  titulo: string;
  destaque?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel" aria-labelledby={id}>
      <header className="sec-head">
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={id} className="h-lg">
          {titulo} {destaque && <em className="h-accent">{destaque}</em>}
        </h2>
      </header>
      <div className="prose">{children}</div>
    </section>
  );
}

/* ---------- página ---------- */
export default function PlanoPrimeiroCliente() {
  return (
    <>
      <section className="panel" aria-labelledby="plano-h">
        <Link href="/" className="voltar">
          ← Central de ferramentas
        </Link>
        <span className="eyebrow" style={{ display: "block", width: "fit-content", margin: "26px 0 20px" }}>
          Plano interno · Captação
        </span>
        <h1 id="plano-h" className="h-xl">
          Como fechamos o
          <br />
          <em className="h-accent">nosso primeiro cliente.</em>
        </h1>
        <p className="lead">
          Um caminho realista para tirar a Neovanguard do zero — sem rede, sem
          verba e com pouco tempo. Foco no que dá resultado agora, não no que
          fica bonito no papel.
        </p>
        <div className="meta">
          <span>
            <b>De</b> Mizael
          </span>
          <span>
            <b>Para</b> sócio
          </span>
          <span>
            <b>Data</b> 05.07.2026
          </span>
          <span>
            <b>Horizonte</b> primeiro cliente pago
          </span>
        </div>
      </section>

      <Secao
        id="leitura-h"
        eyebrow="A leitura franca"
        titulo="Nosso gargalo não é achar quem precisa —"
        destaque="é prova."
      >
        <p>Começamos com quatro restrições reais. Vale encará-las de frente:</p>
        <div className="chips">
          {CHIPS.map(([k, v]) => (
            <span className="chip" key={k}>
              {k}: <b>{v}</b>
            </span>
          ))}
        </div>
        <p>
          Com isso, SEO e conteúdo estão fora (lentos demais) e anúncio está
          fora (custa). Sobra <strong>prospecção ativa cirúrgica</strong>:
          poucos contatos por semana, cada um impecável.
        </p>
        <p>
          E o obstáculo de verdade não é convencer que um negócio precisa de
          site — é <strong>por que contratariam a gente, sem histórico</strong>.
          Todo o plano existe para resolver isso barato.
        </p>
      </Secao>

      <Secao
        id="aposta-h"
        eyebrow="A aposta"
        titulo="Prova fabricada, risco zero e"
        destaque="diagnóstico como isca."
      >
        <p>
          Em vez de esperar o cliente aparecer, a gente vai até ele com um{" "}
          <strong>SCAN gratuito e personalizado</strong> — um mini-diagnóstico
          que mostra, na cara, onde ele está perdendo cliente. É a nossa porta
          de entrada (SCAN → Blueprint → Solução → Flow), só que usada como
          abordagem.
        </p>
        <div className="callout">
          <span>Por que funciona</span>
          <p>
            Um &quot;quer um site?&quot; genérico é ignorado. Um vídeo de 2 min
            dizendo &quot;olha o dinheiro vazando aqui&quot; abre conversa. Como
            não temos volume, cada toque precisa ser cirúrgico — e o SCAN é o
            que faz o volume baixo converter.
          </p>
        </div>
      </Secao>

      <Secao
        id="nicho-h"
        eyebrow="Nicho de partida"
        titulo="Escolher UM nicho"
        destaque="pros primeiros 60 dias."
      >
        <p>
          Com menos de 10h/semana não dá pra ter mensagem genérica. Foco não é
          abandonar os outros segmentos — é cravar um agora e manter os demais
          kits na gaveta pra quando entrar por indicação.
        </p>
        <h3>Critério de escolha</h3>
        <ul className="lista">
          <li>
            Fácil de achar <b>50 deles de graça</b> (Google Maps + Instagram)
          </li>
          <li>
            Presença digital <b>visivelmente ruim</b> — dá pra mostrar valor na
            hora
          </li>
          <li>
            <b>Ticket bom</b> e decisão relativamente rápida
          </li>
        </ul>
        <h3>Minha recomendação: clínicas de estética / odonto</h3>
        <p>
          Ticket alto (kit clínica ~R$ 5.500), gente{" "}
          <strong>obcecada por imagem</strong> — o nosso sistema visual vende
          sozinho pra elas —, lotadas no Instagram e com dor óbvia: o link da
          bio joga pro perfil, ninguém agenda direto.{" "}
          <strong>Restaurantes</strong> são o plano B.
        </p>
      </Secao>

      <Secao
        id="semana-zero-h"
        eyebrow="Fase 01 · Semana zero"
        titulo="Antes de falar com ninguém,"
        destaque="montar o arsenal."
      >
        <p>
          Usamos aqui as ~10h da primeira semana. Sem isso, a prospecção não
          converte.
        </p>
        <ul className="lista lista--marcos">
          {PREP.map(([t, d, h]) => (
            <li key={t}>
              <b>{t}</b> — {d} <span className="horas">{h}</span>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao
        id="cadencia-h"
        eyebrow="Fase 02 · Cadência semanal"
        titulo="Onde vão os menos de 10h,"
        destaque="toda semana."
      >
        <div className="barras">
          {BUDGET.map(([l, pct, v]) => (
            <div className="barra" key={l}>
              <span>{l}</span>
              <span className="trilha">
                <i style={{ width: `${pct}%` }} />
              </span>
              <span className="horas">{v}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 22 }}>
          Na prospecção, para cada um de ~12-15 prospects a gente grava um{" "}
          <strong>vídeo de 2 min</strong> apontando 1 problema concreto. Esse
          micro-diagnóstico <strong>é</strong> o SCAN. A{" "}
          <strong>calculadora que já temos</strong> vira nosso CRM + gerador de
          orçamento.
        </p>
      </Secao>

      <Secao
        id="scripts-h"
        eyebrow="Os roteiros · pode usar quase como estão"
        titulo="Da DM"
        destaque="ao fechamento."
      >
        {SCRIPTS.map((s) => (
          <div className="script" key={s.title}>
            <h3>{s.title}</h3>
            <p>{withPlaceholders(s.body)}</p>
          </div>
        ))}
      </Secao>

      <Secao
        id="fundador-h"
        eyebrow="A oferta de fundador"
        titulo="É o que derruba o medo de contratar"
        destaque="quem não tem histórico."
      >
        <div className="callout">
          <span>A jogada</span>
          <p>
            Os primeiros 2-3 clientes pagam uma{" "}
            <strong>condição de fundador</strong> (desconto forte e/ou parte
            atrelada a resultado){" "}
            <strong>em troca de depoimento + permissão de usar como case</strong>
            . A gente troca margem por prova — e prova é exatamente o que falta
            pra fechar o quarto, o quinto, o décimo sem desconto.
          </p>
        </div>
      </Secao>

      <section className="panel panel--accent" aria-label="Expectativa realista">
        <dl className="nums">
          {STATS.map(([n, k]) => (
            <div key={k} className="num">
              <dt>{n}</dt>
              <dd>{k}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Secao
        id="expectativa-h"
        eyebrow="Expectativa realista"
        titulo="Pra ninguém desanimar"
        destaque="na terceira semana."
      >
        <p>
          Ordem de grandeza: ~13 abordagens → ~2-3 respostas → ~1 call por
          semana. Não é 3 dias. Mas é concreto, custa zero, e cada
          &quot;não&quot; afia a mensagem pro próximo.
        </p>
      </Secao>

      <Secao
        id="favor-h"
        eyebrow="O que já joga a nosso favor"
        titulo="Não estamos"
        destaque="tão no zero assim."
      >
        <ul className="lista">
          {FAVOR.map(([b, rest]) => (
            <li key={b}>
              <b>{b}</b>
              {rest}
            </li>
          ))}
        </ul>
      </Secao>

      <Secao
        id="decidir-h"
        eyebrow="Pra alinharmos"
        titulo="O que preciso"
        destaque="decidir com você."
      >
        <ol className="decide">
          {DECISIONS.map(([b, rest]) => (
            <li key={b}>
              <b>{b}</b>
              {rest}
            </li>
          ))}
        </ol>
      </Secao>

      <section className="closer" aria-label="Próximo passo">
        <h2 className="h-xl">
          Decidido o nicho,
          <br />a Semana 0 começa.
        </h2>
        <div className="pill-row">
          <a href="/calculadora.html" className="pill">
            Abrir a calculadora
            <ArrowUpRight />
          </a>
          <Link href="/" className="pill pill--ghost">
            Voltar à central
          </Link>
        </div>
      </section>

      <Foot />
    </>
  );
}
