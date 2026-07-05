import React from "react";

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
    body: "Te mandei aqui 👆. No vídeo eu mostro 3 pontos rápidos. Se fizer sentido, tenho 20 min essa semana pra te mostrar o blueprint completo — quinta 15h ou sexta 10h?",
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
];

const FAVOR: [string, string][] = [
  ["Calculadora de precificação", " — orçamento em segundos e mini-CRM dos prospects."],
  ["neovanguard.com.br + o visual Blueprint Obsidian", " — prova viva de que sabemos fazer."],
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
    )
  );
}

function Card({
  eyebrow,
  phase,
  children,
  delay,
}: {
  eyebrow: string;
  phase?: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <div className="card" style={{ animationDelay: `${delay}s` }}>
      <p className="eb">
        {phase && <span className="no">{phase} · </span>}
        {eyebrow}
      </p>
      {children}
    </div>
  );
}

/* ---------- página ---------- */
export default function PlanoPrimeiroCliente() {
  return (
    <div className="nvg-plan">
      <style>{css}</style>
      <div className="wrap">
        <a className="back" href="/">← Central de ferramentas</a>

        <header>
          <div className="brand">
            <div className="logo">N</div>
            <div className="nm">NEO<b>VANGUARD</b></div>
          </div>
          <p className="eyebrow">Plano interno · Captação</p>
          <h1>Como fechamos o nosso primeiro cliente</h1>
          <p className="lede">
            Um caminho realista para tirar a Neovanguard do zero — sem rede, sem
            verba e com pouco tempo. Foco no que dá resultado agora, não no que
            fica bonito no papel.
          </p>
          <div className="meta">
            <span><b>De</b> Mizael</span>
            <span><b>Para</b> sócio</span>
            <span><b>Data</b> 05.07.2026</span>
            <span><b>Horizonte</b> primeiro cliente pago</span>
          </div>
        </header>

        <Card eyebrow="A leitura franca" delay={0.05}>
          <h2>Nosso gargalo não é achar quem precisa — é prova.</h2>
          <p>Começamos com quatro restrições reais. Vale encará-las de frente:</p>
          <div className="chips">
            {CHIPS.map(([k, v]) => (
              <span className="chip" key={k}>{k}: <b>{v}</b></span>
            ))}
          </div>
          <p>
            Com isso, SEO e conteúdo estão fora (lentos demais) e anúncio está
            fora (custa). Sobra <b>prospecção ativa cirúrgica</b>: poucos
            contatos por semana, cada um impecável.
          </p>
          <p>
            E o obstáculo de verdade não é convencer que um negócio precisa de
            site — é <b className="em-v">por que contratariam a gente, sem
            histórico</b>. Todo o plano existe para resolver isso barato.
          </p>
        </Card>

        <Card eyebrow="A aposta" delay={0.1}>
          <h2>Prova fabricada + oferta de risco zero + diagnóstico como isca.</h2>
          <p>
            Em vez de esperar o cliente aparecer, a gente vai até ele com um{" "}
            <b>SCAN gratuito e personalizado</b> — um mini-diagnóstico que mostra,
            na cara, onde ele está perdendo cliente. É a nossa porta de entrada
            (SCAN → Blueprint → Solução → Flow), só que usada como abordagem.
          </p>
          <div className="callout good">
            <span className="tag">Por que funciona</span>
            <p>
              Um &quot;quer um site?&quot; genérico é ignorado. Um vídeo de 2 min
              dizendo &quot;olha o dinheiro vazando aqui&quot; abre conversa. Como
              não temos volume, cada toque precisa ser cirúrgico — e o SCAN é o
              que faz o volume baixo converter.
            </p>
          </div>
        </Card>

        <Card eyebrow="Nicho de partida" delay={0.15}>
          <h2>Escolher UM nicho pros primeiros 60 dias.</h2>
          <p>
            Com menos de 10h/semana não dá pra ter mensagem genérica. Foco não é
            abandonar os outros segmentos — é cravar um agora e manter os demais
            kits na gaveta pra quando entrar por indicação.
          </p>
          <h3>Critério de escolha</h3>
          <ul className="clean">
            <li>Fácil de achar <b>50 deles de graça</b> (Google Maps + Instagram)</li>
            <li>Presença digital <b>visivelmente ruim</b> — dá pra mostrar valor na hora</li>
            <li><b>Ticket bom</b> e decisão relativamente rápida</li>
          </ul>
          <h3>Minha recomendação: clínicas de estética / odonto</h3>
          <p>
            Ticket alto (kit clínica ~R$ 5.500), gente <b>obcecada por imagem</b>
            {" "}— o nosso visual Blueprint Obsidian vende sozinho pra elas —,
            lotadas no Instagram e com dor óbvia: o link da bio joga pro perfil,
            ninguém agenda direto. <span className="em-v">Restaurantes</span> são
            o plano B.
          </p>
        </Card>

        <Card eyebrow="Semana zero — munição" phase="Fase 01" delay={0.2}>
          <h2>Antes de falar com ninguém, montar o arsenal.</h2>
          <p>Usamos aqui as ~10h da primeira semana. Sem isso, a prospecção não converte.</p>
          <ul className="clean check">
            {PREP.map(([t, d, h]) => (
              <li key={t}><b>{t}</b> — {d} <span className="hrs">{h}</span></li>
            ))}
          </ul>
        </Card>

        <Card eyebrow="Cadência semanal recorrente" phase="Fase 02" delay={0.25}>
          <h2>Onde vão os menos de 10h, toda semana.</h2>
          <div className="budget">
            {BUDGET.map(([l, pct, v]) => (
              <div className="brow" key={l}>
                <span className="l">{l}</span>
                <span className="track"><span className="fill" style={{ width: `${pct}%` }} /></span>
                <span className="v">{v}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16 }}>
            Na prospecção, para cada um de ~12-15 prospects a gente grava um{" "}
            <b>vídeo de 2 min</b> apontando 1 problema concreto. Esse
            micro-diagnóstico <b>é</b> o SCAN. A{" "}
            <b className="em-v">calculadora que já temos</b> vira nosso CRM +
            gerador de orçamento.
          </p>
        </Card>

        <Card eyebrow="Os scripts · pode usar quase como estão" delay={0.3}>
          <h2>Da DM ao fechamento.</h2>
          {SCRIPTS.map((s) => (
            <div className="script" key={s.title}>
              <div className="sh">{s.title}</div>
              <div className="sb">{withPlaceholders(s.body)}</div>
            </div>
          ))}
        </Card>

        <Card eyebrow="A oferta de fundador" delay={0.35}>
          <h2>É o que derruba o medo de contratar quem não tem histórico.</h2>
          <div className="callout good">
            <span className="tag">A jogada</span>
            <p>
              Os primeiros 2-3 clientes pagam uma <b>condição de fundador</b>
              {" "}(desconto forte e/ou parte atrelada a resultado){" "}
              <b>em troca de depoimento + permissão de usar como case</b>. A gente
              troca margem por prova — e prova é exatamente o que falta pra fechar
              o quarto, o quinto, o décimo sem desconto.
            </p>
          </div>
        </Card>

        <Card eyebrow="Expectativa realista" delay={0.4}>
          <h2>Pra ninguém desanimar na terceira semana.</h2>
          <div className="stats">
            {STATS.map(([n, k]) => (
              <div className="tile" key={k}>
                <div className="n">{n}</div>
                <div className="k">{k}</div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16 }}>
            Ordem de grandeza: ~13 abordagens → ~2-3 respostas → ~1 call por
            semana. Não é 3 dias. Mas é concreto, custa zero, e cada &quot;não&quot;
            afia a mensagem pro próximo.
          </p>
        </Card>

        <Card eyebrow="O que já joga a nosso favor" delay={0.45}>
          <h2>Não estamos tão no zero assim.</h2>
          <ul className="clean">
            {FAVOR.map(([b, rest]) => (
              <li key={b}><b>{b}</b>{rest}</li>
            ))}
          </ul>
        </Card>

        <Card eyebrow="Pra alinharmos" delay={0.5}>
          <h2>O que preciso decidir com você.</h2>
          <ol className="decide">
            {DECISIONS.map(([b, rest]) => (
              <li key={b}><b>{b}</b>{rest}</li>
            ))}
          </ol>
        </Card>

        <div className="foot">NEOVANGUARD · plano de captação v1 · documento interno</div>
      </div>
    </div>
  );
}

/* ---------- estilo (escopado sob .nvg-plan) ---------- */
const css = `
.nvg-plan{
  --surface:rgba(9,7,15,.93); --hairline:rgba(167,139,250,.18);
  --hairline-hi:rgba(139,92,246,.55); --accent:#8b5cf6; --accent-hover:#7c3aed;
  --accent-light:#a78bfa; --accent-subtle:rgba(139,92,246,.10);
  --txt:#f2f0f5; --txt-2:#b6b2c2; --txt-3:#8a8697; --warn:#fbbf24;
  --mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
  --sans:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
  color:var(--txt); font-family:var(--sans); font-size:15.5px; line-height:1.62;
  -webkit-font-smoothing:antialiased; min-height:100vh;
  background:
    radial-gradient(1100px 560px at 84% -10%, rgba(139,92,246,.13), transparent 60%),
    radial-gradient(820px 480px at -10% 12%, rgba(124,58,237,.10), transparent 55%),
    linear-gradient(rgba(139,92,246,.022) 1px, transparent 1px) 0 0/44px 44px,
    linear-gradient(90deg, rgba(139,92,246,.022) 1px, transparent 1px) 0 0/44px 44px,
    #050408;
}
.nvg-plan *{box-sizing:border-box}
.nvg-plan .wrap{max-width:768px;margin:0 auto;padding:34px 22px 96px}
.nvg-plan .back{display:inline-block;margin-bottom:26px;font-family:var(--mono);font-size:11.5px;letter-spacing:.06em;color:var(--txt-3);transition:color .2s}
.nvg-plan .back:hover{color:var(--accent-light)}
.nvg-plan p{margin:0 0 12px}
.nvg-plan b,.nvg-plan strong{color:var(--txt);font-weight:650}
.nvg-plan .em-v{color:var(--accent-light)}
.nvg-plan header{margin-bottom:34px}
.nvg-plan .brand{display:flex;align-items:center;gap:12px;margin-bottom:26px}
.nvg-plan .logo{width:36px;height:36px;border:1.5px solid var(--accent);display:grid;place-items:center;color:var(--accent-light);font-weight:800;font-size:16px;box-shadow:inset 0 0 22px rgba(139,92,246,.28)}
.nvg-plan .brand .nm{font-size:14px;letter-spacing:.02em}
.nvg-plan .brand .nm b{color:var(--accent-light)}
.nvg-plan .eyebrow{font-family:var(--mono);font-size:10.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--accent-light);margin:0 0 12px}
.nvg-plan h1{font-size:33px;line-height:1.1;letter-spacing:-.015em;margin:0 0 14px;text-wrap:balance;font-weight:720}
.nvg-plan .lede{font-size:16.5px;color:var(--txt-2);max-width:60ch;margin:0}
.nvg-plan .meta{display:flex;flex-wrap:wrap;gap:6px 22px;margin-top:22px;padding-top:16px;border-top:1px solid var(--hairline);font-family:var(--mono);font-size:11px;letter-spacing:.05em;color:var(--txt-3)}
.nvg-plan .meta b{color:var(--txt-2);font-weight:500}
.nvg-plan .card{
  position:relative;background-color:var(--surface);
  background-image:
    linear-gradient(var(--accent),var(--accent)),linear-gradient(var(--accent),var(--accent)),
    linear-gradient(var(--accent),var(--accent)),linear-gradient(var(--accent),var(--accent)),
    linear-gradient(var(--accent),var(--accent)),linear-gradient(var(--accent),var(--accent)),
    linear-gradient(var(--accent),var(--accent)),linear-gradient(var(--accent),var(--accent));
  background-repeat:no-repeat;
  background-size:14px 1px,1px 14px,14px 1px,1px 14px,14px 1px,1px 14px,14px 1px,1px 14px;
  background-position:left top,left top,right top,right top,left bottom,left bottom,right bottom,right bottom;
  border:1px solid var(--hairline);border-left:2px solid var(--hairline-hi);
  padding:22px 24px;margin:0 0 16px;opacity:0;transform:translateY(14px);
  animation:nvg-rise .6s cubic-bezier(.2,.7,.2,1) forwards;
  transition:border-color .25s,box-shadow .25s;
}
.nvg-plan .card:hover{border-color:var(--hairline-hi);box-shadow:0 0 0 1px rgba(139,92,246,.14),0 22px 60px -34px rgba(124,58,237,.7)}
@keyframes nvg-rise{to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.nvg-plan .card{animation:none;opacity:1;transform:none}}
.nvg-plan .eb{font-family:var(--mono);font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent-light);margin:0 0 10px}
.nvg-plan .eb .no{color:var(--txt-3)}
.nvg-plan .card h2{font-size:20px;line-height:1.2;letter-spacing:-.01em;margin:0 0 10px;font-weight:680}
.nvg-plan .card h3{font-size:13px;margin:18px 0 8px;color:var(--txt);font-weight:640}
.nvg-plan .card p:last-child{margin-bottom:0}
.nvg-plan .callout{border:1px solid var(--hairline);border-left:2px solid var(--accent);background:var(--accent-subtle);padding:15px 17px;margin:0;font-size:14.5px}
.nvg-plan .callout .tag{font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent-light);display:block;margin-bottom:8px}
.nvg-plan .callout p:last-child{margin-bottom:0}
.nvg-plan .chips{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 12px}
.nvg-plan .chip{font-family:var(--mono);font-size:11px;letter-spacing:.04em;color:var(--txt-2);border:1px solid var(--hairline);padding:6px 11px;background:rgba(139,92,246,.05)}
.nvg-plan .chip b{color:var(--warn);font-weight:600}
.nvg-plan ul.clean{list-style:none;margin:6px 0 0;padding:0}
.nvg-plan ul.clean li{position:relative;padding:8px 0 8px 26px;border-top:1px solid rgba(167,139,250,.09);font-size:14.5px;color:var(--txt-2)}
.nvg-plan ul.clean li:first-child{border-top:0}
.nvg-plan ul.clean li::before{content:"→";position:absolute;left:2px;color:var(--accent-light);font-family:var(--mono);font-size:13px}
.nvg-plan ul.check li::before{content:"◇"}
.nvg-plan ul.clean li b{color:var(--txt)}
.nvg-plan .hrs{font-family:var(--mono);font-size:11px;color:var(--txt-3);margin-left:6px}
.nvg-plan .budget{margin-top:8px;display:flex;flex-direction:column;gap:11px}
.nvg-plan .brow{display:grid;grid-template-columns:132px 1fr auto;align-items:center;gap:12px}
.nvg-plan .brow .l{font-size:13px;color:var(--txt-2)}
.nvg-plan .brow .track{height:8px;background:rgba(139,92,246,.08);border:1px solid var(--hairline);position:relative;overflow:hidden}
.nvg-plan .brow .fill{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,var(--accent-hover),var(--accent-light));box-shadow:0 0 14px rgba(139,92,246,.5)}
.nvg-plan .brow .v{font-family:var(--mono);font-size:12px;color:var(--accent-light);font-variant-numeric:tabular-nums}
.nvg-plan .script{border:1px solid var(--hairline);border-left:2px solid var(--accent);background:#050408;margin:0 0 12px}
.nvg-plan .script .sh{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-light);padding:11px 15px;border-bottom:1px solid var(--hairline);background:rgba(139,92,246,.06)}
.nvg-plan .script .sb{padding:14px 15px;font-size:14px;color:var(--txt-2);line-height:1.6}
.nvg-plan .script .sb em{color:var(--txt-3);font-style:normal}
.nvg-plan .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:6px}
.nvg-plan .tile{border:1px solid var(--hairline);border-left:2px solid var(--hairline-hi);padding:15px 14px;background:rgba(139,92,246,.04)}
.nvg-plan .tile .n{font-family:var(--mono);font-weight:800;font-size:24px;color:#fff;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.nvg-plan .tile .k{font-size:11.5px;color:var(--txt-3);margin-top:5px;line-height:1.35}
.nvg-plan ol.decide{list-style:none;counter-reset:d;margin:6px 0 0;padding:0}
.nvg-plan ol.decide li{counter-increment:d;position:relative;padding:12px 0 12px 40px;border-top:1px solid rgba(167,139,250,.09);font-size:14.5px;color:var(--txt-2)}
.nvg-plan ol.decide li:first-child{border-top:0}
.nvg-plan ol.decide li::before{content:counter(d,decimal-leading-zero);position:absolute;left:0;top:12px;font-family:var(--mono);font-size:11px;color:var(--accent-light);border:1px solid var(--hairline-hi);width:24px;height:24px;display:grid;place-items:center}
.nvg-plan ol.decide li b{color:var(--txt)}
.nvg-plan .foot{margin-top:30px;padding-top:16px;border-top:1px solid var(--hairline);font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;color:var(--txt-3);text-align:center}
@media(max-width:560px){.nvg-plan .stats{grid-template-columns:1fr}.nvg-plan .brow{grid-template-columns:104px 1fr auto}}
`;
