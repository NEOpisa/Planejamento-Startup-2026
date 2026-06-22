import MissoesBoard from "@/components/missoes/MissoesBoard";

export const metadata = {
  title: "Missões · NEOVANGUARD",
  description: "Painel de missões dos sócios.",
};

export default function MissoesPage() {
  return (
    <main className="inner">
      <div className="page-header">
        <span className="section-eyebrow">Agência de Soluções Digitais · Painel interno 2026</span>
        <h1 className="page-heading">
          Mi<span className="text-accent-nvg">ss</span>ões
        </h1>
        <p className="page-sub">Crie missões para os sócios · defina responsável, prioridade e prazo</p>
      </div>

      <div className="badge" style={{ marginBottom: 16 }}>
        <span className="badge-dot" />
        Atualização contínua
      </div>
      <h2 className="phase-title">Missões dos sócios</h2>
      <p className="phase-desc">
        Ver as missões é livre. Para adicionar, mover de status ou remover, é preciso entrar com a senha.
      </p>

      <MissoesBoard />
    </main>
  );
}
