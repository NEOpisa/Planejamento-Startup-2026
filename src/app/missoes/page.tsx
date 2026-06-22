import MissoesGate from "@/components/missoes/MissoesGate";
import MissoesBoard from "@/components/missoes/MissoesBoard";

export const metadata = {
  title: "Missões · NEOVANGUARD",
  description: "Painel de missões dos sócios.",
};

export default function MissoesPage() {
  return (
    <MissoesGate>
      <main className="inner">
        <div className="page-header">
          <span className="section-eyebrow">Agência de Soluções Digitais · Painel interno 2026</span>
          <h1 className="page-heading">
            Mi<span className="text-accent-nvg">ss</span>ões
          </h1>
          <p className="page-sub">Missões da empresa · sua área própria · notificações por sócio</p>
        </div>

        <div className="badge" style={{ marginBottom: 16 }}>
          <span className="badge-dot" />
          Atualização contínua
        </div>

        <MissoesBoard />
      </main>
    </MissoesGate>
  );
}
