"use client";

import { useState } from "react";
import Link from "next/link";
import { useClientes, type ClienteStatus } from "@/hooks/useClientes";
import { useAuth } from "@/hooks/useAuth";

const STATUS_BADGE: Record<ClienteStatus, { className: string; label: string }> = {
  pendente: { className: "status-pendente", label: "Pendente" },
  "em-andamento": { className: "status-em-andamento", label: "Em andamento" },
  finalizado: { className: "status-finalizado", label: "Finalizado" },
};

function OpenIcon() {
  return (
    <svg
      className="entity-open-icon"
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

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

  // Ranking: quem atendeu mais (clientes com Atendente definido).
  const contagem = new Map<string, { atendidos: number; finalizados: number }>();
  for (const c of clientes) {
    if (!c.Atendente) continue;
    const r = contagem.get(c.Atendente) ?? { atendidos: 0, finalizados: 0 };
    r.atendidos += 1;
    if (c.Status === "finalizado") r.finalizados += 1;
    contagem.set(c.Atendente, r);
  }
  const ranking = [...contagem.entries()]
    .map(([nome, r]) => ({ nome, ...r }))
    .sort((a, b) => b.atendidos - a.atendidos || b.finalizados - a.finalizados);

  async function handleSubmit() {
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      alert("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    const ok = await addCliente({ Nome: nomeTrim, Tipo: tipo.trim() || null, Status: status });
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
          <div className="stat-desc">concluídos</div>
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

      {ranking.length > 0 && (
        <section className="ranking">
          <h3 className="ranking-title">Ranking de atendimento</h3>
          <ol className="ranking-list">
            {ranking.map((r, i) => (
              <li key={r.nome} className="ranking-row">
                <span className="ranking-pos">{String(i + 1).padStart(2, "0")}</span>
                <span className="ranking-nome">{r.nome}</span>
                <span className="ranking-num">
                  <strong>{r.atendidos}</strong>{" "}
                  {r.atendidos === 1 ? "atendimento" : "atendimentos"}
                  <span className="ranking-fin">· {r.finalizados} finalizado{r.finalizados === 1 ? "" : "s"}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="entity-list">
        {clientes.length === 0 && (
          <p className="empty-state">
            Nenhum cliente cadastrado ainda. Use &quot;Novo cliente&quot; para adicionar.
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
                      {c.Origem && <span className="lead-tag">via site</span>}
                      {c.Atendente && <span className="entity-atendente">{c.Atendente}</span>}
                      <span className={`status-badge ${badge.className}`}>{badge.label}</span>
                    </div>
                  </div>
                </Link>
                {isFinalizado ? (
                  <button className="entity-action-btn checked" disabled>
                    Finalizado
                  </button>
                ) : travado ? (
                  <span className="entity-locked" title={`Em atendimento por ${c.Atendente}`}>
                    Em atendimento · {c.Atendente}
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
                <OpenIcon />
              </div>
            </div>
          );
        })}
      </div>

      <button className="add-btn" onClick={() => setFormOpen((v) => !v)}>
        + Novo cliente
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
                <option value="pendente">Pendente</option>
                <option value="em-andamento">Em andamento</option>
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
