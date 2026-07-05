const NAV = [
  {
    href: "/calculadora.html",
    eyebrow: "Ferramenta · Vendas",
    title: "Calculadora de Precificação",
    desc: "Monte o orçamento de cada cliente: 102 itens, presets por segmento, MRR, piso de margem e orçamento pronto pro WhatsApp.",
    cta: "Abrir calculadora",
    external: true,
  },
  {
    href: "/plano",
    eyebrow: "Estratégia · Captação",
    title: "Plano · Primeiro Cliente",
    desc: "O caminho pra fechar o primeiro cliente do zero: nicho, cadência semanal, scripts prontos e as decisões pra alinhar com o sócio.",
    cta: "Abrir plano",
    external: false,
  },
];

export default function Home() {
  return (
    <main className="nvg-home">
      <style>{css}</style>
      <div className="wrap">
        <header>
          <div className="brand">
            <div className="logo">N</div>
            <div className="nm">NEO<b>VANGUARD</b></div>
          </div>
          <p className="eyebrow">Central de ferramentas · uso interno</p>
          <h1>Planejamento Neovanguard</h1>
          <p className="lede">Tudo que a gente usa pra vender e organizar a operação, num lugar só. Escolha por onde começar.</p>
        </header>

        <nav className="cards">
          {NAV.map((n) => (
            <a
              key={n.href}
              className="navcard"
              href={n.href}
              {...(n.external ? { target: "_blank", rel: "noopener" } : {})}
            >
              <span className="eb">{n.eyebrow}</span>
              <span className="ct">{n.title}</span>
              <span className="ds">{n.desc}</span>
              <span className="go">{n.cta} <span className="arrow">→</span></span>
            </a>
          ))}
        </nav>

        <div className="foot">NEOVANGUARD · documento interno</div>
      </div>
    </main>
  );
}

const css = `
.nvg-home{
  --surface:rgba(9,7,15,.93); --hairline:rgba(167,139,250,.18);
  --hairline-hi:rgba(139,92,246,.55); --accent:#8b5cf6; --accent-hover:#7c3aed;
  --accent-light:#a78bfa; --txt:#f2f0f5; --txt-2:#b6b2c2; --txt-3:#8a8697;
  --mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
  display:block; min-height:100vh;
  background:
    radial-gradient(1100px 560px at 84% -10%, rgba(139,92,246,.14), transparent 60%),
    radial-gradient(820px 480px at -10% 12%, rgba(124,58,237,.10), transparent 55%),
    linear-gradient(rgba(139,92,246,.022) 1px, transparent 1px) 0 0/44px 44px,
    linear-gradient(90deg, rgba(139,92,246,.022) 1px, transparent 1px) 0 0/44px 44px,
    #050408;
}
.nvg-home .wrap{max-width:860px;margin:0 auto;padding:72px 22px 96px}
.nvg-home header{margin-bottom:40px}
.nvg-home .brand{display:flex;align-items:center;gap:12px;margin-bottom:30px}
.nvg-home .logo{width:38px;height:38px;border:1.5px solid var(--accent);display:grid;place-items:center;color:var(--accent-light);font-weight:800;font-size:17px;box-shadow:inset 0 0 22px rgba(139,92,246,.28)}
.nvg-home .nm{font-size:14px;letter-spacing:.02em}
.nvg-home .nm b{color:var(--accent-light)}
.nvg-home .eyebrow{font-family:var(--mono);font-size:10.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--accent-light);margin:0 0 14px}
.nvg-home h1{font-size:38px;line-height:1.08;letter-spacing:-.02em;margin:0 0 14px;font-weight:730;text-wrap:balance}
.nvg-home .lede{font-size:16.5px;color:var(--txt-2);max-width:56ch;margin:0}
.nvg-home .cards{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:680px){.nvg-home .cards{grid-template-columns:1fr}.nvg-home h1{font-size:31px}}
.nvg-home .navcard{
  position:relative;display:flex;flex-direction:column;gap:9px;
  background-color:var(--surface);
  background-image:
    linear-gradient(var(--accent),var(--accent)),linear-gradient(var(--accent),var(--accent)),
    linear-gradient(var(--accent),var(--accent)),linear-gradient(var(--accent),var(--accent)),
    linear-gradient(var(--accent),var(--accent)),linear-gradient(var(--accent),var(--accent)),
    linear-gradient(var(--accent),var(--accent)),linear-gradient(var(--accent),var(--accent));
  background-repeat:no-repeat;
  background-size:16px 1px,1px 16px,16px 1px,1px 16px,16px 1px,1px 16px,16px 1px,1px 16px;
  background-position:left top,left top,right top,right top,left bottom,left bottom,right bottom,right bottom;
  border:1px solid var(--hairline);border-left:2px solid var(--hairline-hi);
  padding:24px 22px 20px;min-height:210px;
  transition:border-color .25s,box-shadow .25s,transform .25s;
}
.nvg-home .navcard:hover{border-color:var(--hairline-hi);transform:translateY(-3px);box-shadow:0 0 0 1px rgba(139,92,246,.16),0 26px 60px -30px rgba(124,58,237,.75)}
.nvg-home .eb{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent-light)}
.nvg-home .ct{font-size:21px;font-weight:690;letter-spacing:-.01em;line-height:1.15}
.nvg-home .ds{font-size:14px;color:var(--txt-2);line-height:1.55;flex:1}
.nvg-home .go{font-family:var(--mono);font-size:12px;letter-spacing:.04em;color:var(--txt);display:inline-flex;align-items:center;gap:8px;margin-top:4px}
.nvg-home .arrow{transition:transform .25s;display:inline-block}
.nvg-home .navcard:hover .arrow{transform:translateX(5px);color:var(--accent-light)}
.nvg-home .foot{margin-top:44px;padding-top:16px;border-top:1px solid var(--hairline);font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;color:var(--txt-3);text-align:center}
`;
