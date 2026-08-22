import Link from "next/link";

import Foot from "@/components/shell/Foot";
import { ArrowUpRight, MicIcon } from "@/components/icons";
import { comBase } from "@/lib/base.mjs";

/**
 * HOME — a porta da central. Um painel de abertura, a grade das três
 * ferramentas, a faixa do que a casa combina e o fecho. Mesmo ritmo de
 * painéis do site público, rolagem nativa do começo ao fim.
 */

const FERRAMENTAS = [
  {
    n: "01",
    href: "/calculadora.html",
    externo: true,
    t: "Calculadora de precificação",
    d: "O orçamento de cada cliente: 102 itens, presets por segmento, MRR, piso de margem e o texto pronto para mandar no WhatsApp.",
    cta: "Abrir calculadora",
    tags: ["Vendas", "Offline", "Arquivo único"],
  },
  {
    n: "02",
    href: "/plano",
    externo: false,
    t: "Plano · primeiro cliente",
    d: "O caminho para fechar o primeiro cliente do zero: nicho, cadência semanal, roteiros prontos e as decisões para alinhar com o sócio.",
    cta: "Abrir plano",
    tags: ["Captação", "Estratégia"],
  },
  {
    n: "03",
    href: comBase("/"),
    externo: false,
    t: "NVDISC · sala de voz",
    d: "Voz, tela e texto numa sala. Sem conta e sem cadastro: um nome, um código, e quem digitar o mesmo código cai na mesma sala.",
    cta: "Abrir sala",
    tags: ["Conversa", "Direto entre navegadores"],
  },
];

const COMBINADOS: [string, string][] = [
  ["3", "ferramentas em um endereço só"],
  ["R$ 0", "de custo mensal para manter"],
  ["1", "processo servindo tudo"],
  ["0", "dado guardado em banco"],
];

export default function Home() {
  return (
    <>
      <section className="panel" aria-labelledby="home-h">
        <span className="eyebrow">Central interna</span>
        <h1 id="home-h" className="h-xl" style={{ marginTop: 20 }}>
          As ferramentas da casa,
          <br />
          <em className="h-accent">num lugar só.</em>
        </h1>
        <p className="lead">
          Tudo que a gente usa para vender e organizar a operação. Nada aqui é
          público: <strong>valores, estratégia e conversas ficam entre nós.</strong>
        </p>
        <div className="pill-row">
          <a href="/calculadora.html" className="pill">
            Orçar um cliente agora
            <ArrowUpRight />
          </a>
          <Link href={comBase("/")} className="pill pill--ghost">
            <MicIcon />
            Abrir uma sala
          </Link>
        </div>
      </section>

      <section className="panel" aria-labelledby="ferramentas-h">
        <header className="sec-head">
          <span className="eyebrow">O que tem aqui</span>
          <h2 id="ferramentas-h" className="h-lg">
            Três ferramentas, <em className="h-accent">uma operação só.</em>
          </h2>
        </header>
        <div className="cards">
          {FERRAMENTAS.map((f) =>
            f.externo ? (
              <a key={f.href} href={f.href} className="card">
                <ConteudoDoCartao {...f} />
              </a>
            ) : (
              <Link key={f.href} href={f.href} className="card">
                <ConteudoDoCartao {...f} />
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="panel panel--accent" aria-label="A central em números">
        <dl className="nums">
          {COMBINADOS.map(([n, l]) => (
            <div key={l} className="num">
              <dt>{n}</dt>
              <dd>{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="closer" aria-label="Por onde começar">
        <h2 className="h-xl">
          Escolhe uma
          <br />e toca o trabalho.
        </h2>
        <p className="lead">
          Na dúvida: a calculadora quando há um cliente na mesa, o plano quando
          não há.
        </p>
        <div className="pill-row">
          <Link href="/plano" className="pill">
            Ler o plano
            <ArrowUpRight />
          </Link>
        </div>
      </section>

      <Foot />
    </>
  );
}

function ConteudoDoCartao({
  n,
  t,
  d,
  cta,
  tags,
}: {
  n: string;
  t: string;
  d: string;
  cta: string;
  tags: string[];
}) {
  return (
    <>
      <span className="card-n">{n}</span>
      <h3 className="card-t">{t}</h3>
      <p className="card-d">{d}</p>
      <div className="card-tags">
        {tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
      <span className="card-go">
        {cta}
        <ArrowUpRight />
      </span>
    </>
  );
}
