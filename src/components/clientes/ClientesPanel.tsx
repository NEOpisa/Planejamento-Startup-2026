"use client";

import { useState } from "react";
import Link from "next/link";
import { useClientes, type ClienteStatus } from "@/hooks/useClientes";
import { useAuth } from "@/hooks/useAuth";

const STATUS_BADGE: Record<ClienteStatus, { className: string; label: string }> = {
  pendente: { className: "status-pendente", label: "◌ Pendente" },
  "em-andamento": { className: "status-em-andamento", label: "⏳ Em andamento" },
  finalizado: { className: "status-finalizado", label: "✓ Finalizado" },
};

export default function ClientesPanel() {
  const { clientes, addCliente, atender, finalizar } = useClientes();
  const { vendedor } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState<ClienteStatus>("pendente");

  const total = clientes.length;
  const finalizados = clientes.filter((c) => c.Status === "finalizado").length;
  const andamento = clientes.filter((c) => c.Status === "em-andamento").length;
  const pendentes = clientes.filter((c) => c.Status === "pendente").length;

  async function handleSubmit() {
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      alert("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    const ok = await addCliente({
      Nome: nomeTrim,
      Tipo: tipo.trim() || null,
      Status: status,
    });
    setSaving(false);
    if (!ok) {
      alert("Erro ao salvar. Verifique o console.");
      return;
    }
    setNome("");
    setTipo("");
    setStatus("pendente");
    setFormOpen(false);
  }

  return (
    <div>
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{total}</div>
          <div className="stat-desc">clientes cadastrados</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Finalizados</div>
          <div className="stat-value">{finalizados}</div>
          <div className="stat-desc">concluídos ✓</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Em andamento</div>
          <div className="stat-value">{andamento}</div>
          <div className="stat-desc">em execução</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pendentes</div>
          <div className="stat-value">{pendentes}</div>
          <div className="stat-desc">aguardando início</div>
        </div>
      </div>

      <div className="entity-list">
        {clientes.length === 0 && (
          <p className="empty-state">
            Nenhum cliente cadastrado ainda. Clique em &quot;+ Novo cliente&quot; para adicionar.
          </p>
        )}
        {clientes.map((c) => {
          const isFinalizado = c.Status === "finalizado";
          const badge = STATUS_BADGE[c.Status];
          const meuAtendimento = !!c.Atendente && c.Atendente === vendedor;
          const travado = !!c.Atendente && !meuAtendimento && !isFinalizado;
          return (
            <div className={`entity-card ${isFinalizado ? "finalizado" : ""}`} key={c.id}>
              <div className="entity-card-head">
                <Link
                  href={`/clientes/${c.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="entity-card-link"
                >
                  <div className={`entity-avatar ${isFinalizado ? "finalizado" : ""}`}>
                    {(c.Nome || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="entity-meta">
                    <div className="entity-name">{c.Nome}</div>
                    <div className="entity-info-row">
                      <span className="entity-tipo">{c.Tipo || "—"}</span>
                      {c.Origem && <span className="lead-tag">⚡ via site</span>}
                      {c.Atendente && (
                        <span className="entity-atendente">👤 {c.Atendente}</span>
                      )}
                      <span className={`status-badge ${badge.className}`}>{badge.label}</span>
                    </div>
                  </div>
                </Link>
                {isFinalizado ? (
                  <button className="entity-action-btn checked" disabled>
                    ✓ Finalizado
                  </button>
                ) : travado ? (
                  <span className="entity-locked" title={`Em atendimento por ${c.Atendente}`}>
                    🔒 {c.Atendente}
                  </span>
                ) : c.Status === "em-andamento" ? (
                  <button className="entity-action-btn" onClick={() => void finalizar(c.id)}>
                    Finalizar
                  </button>
                ) : (
                  <button
                    className="entity-action-btn"
                    onClick={() => vendedor && void atender(c.id, vendedor)}
                  >
                    Atender
                  </button>
                )}
                <span className="entity-open-icon" aria-hidden="true">↗</span>
              </div>
            </div>
          );
        })}
      </div>

      <button className="add-btn" onClick={() => setFormOpen((v) => !v)}>
        ＋ Novo cliente
      </button>

      <div className={`add-form ${formOpen ? "open" : ""}`}>
        <div className="add-form-inner">
          <div className="add-form-card">
            <div className="form-row cols-2">
              <label className="form-group">
                <span className="form-label">Nome do cliente</span>
                <input
                  className="form-input"
                  placeholder="Ex: João da Silva / Empresa X"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Tipo / Segmento</span>
                <input
                  className="form-input"
                  placeholder="Ex: E-commerce, Institucional…"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                />
              </label>
            </div>
            <label className="form-group">
              <span className="form-label">Status inicial</span>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as ClienteStatus)}
              >
                <option value="pendente">◌ Pendente</option>
                <option value="em-andamento">⏳ Em andamento</option>
              </select>
            </label>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setFormOpen(false)}>
                Cancelar
              </button>
              <button className="btn-save" onClick={handleSubmit} disabled={saving}>
                {saving ? "Salvando…" : "Salvar cliente"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
