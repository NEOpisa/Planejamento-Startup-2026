"use client";

import { useState } from "react";
import ClientesPanel from "@/components/clientes/ClientesPanel";
import AvaliacaoPanel from "@/components/clientes/AvaliacaoPanel";

type View = "clientes" | "avaliacao";

export default function ClientesPage() {
  const [view, setView] = useState<View>("clientes");

  return (
    <main className="inner">
      <div className="page-header">
        <span className="section-eyebrow">Agência de Soluções Digitais · Registro 2026</span>
        <h1 className="page-heading">
          Clientes & <span className="text-gradient">Revisões</span>
        </h1>
        <p className="page-sub">Histórico de atendimentos · Avaliações técnicas</p>
      </div>

      <div className="block-label">{"// visualizar por"}</div>
      <div className="tab-row">
        <button className={`tab-btn ${view === "clientes" ? "active" : ""}`} onClick={() => setView("clientes")}>
          Clientes
        </button>
        <button className={`tab-btn ${view === "avaliacao" ? "active" : ""}`} onClick={() => setView("avaliacao")}>
          Avaliação Técnica
        </button>
      </div>

      {view === "clientes" ? (
        <section>
          <div className="badge" style={{ marginBottom: 16 }}>
            <span className="badge-dot" />
            Atualização contínua
          </div>
          <h2 className="phase-title">Clientes Atendidos</h2>
          <p className="phase-desc">
            Marque os clientes que já foram atendidos e registre informações do atendimento. Clique em
            &quot;+ Novo cliente&quot; para adicionar.
          </p>
          <ClientesPanel />
        </section>
      ) : (
        <section>
          <div className="badge" style={{ marginBottom: 16 }}>
            <span className="badge-dot" />
            Revisão interna
          </div>
          <h2 className="phase-title">Avaliação Técnica do Produto/Projeto</h2>
          <p className="phase-desc">
            Registro de avaliação técnica de cada entrega: qualidade do código, design, segurança e prazo.
          </p>
          <AvaliacaoPanel />
        </section>
      )}
    </main>
  );
}
