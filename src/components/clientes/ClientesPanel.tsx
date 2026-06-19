"use client";

import { useState } from "react";
import { useClientes, type ClienteStatus } from "@/hooks/useClientes";

const STATUS_BADGE: Record<ClienteStatus, { className: string; label: string }> = {
  pendente: { className: "status-pendente", label: "◌ Pendente" },
  "em-andamento": { className: "status-em-andamento", label: "⏳ Em andamento" },
  finalizado: { className: "status-finalizado", label: "✓ Finalizado" },
};

const ACTION_LABEL: Partial<Record<ClienteStatus, string>> = {
  pendente: "Iniciar",
  "em-andamento": "Finalizar",
};

const ORIGEM_LABEL: Record<string, string> = {
  orcamento: "🧮 Orçamento",
  pacote: "📦 Pacote",
};

export default function ClientesPanel() {
  const { clientes, addCliente, avancarStatus, removerCliente } = useClientes();
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [status, setStatus] = useState<ClienteStatus>("pendente");
  const [obs, setObs] = useState("");

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
      "Obs.": obs.trim() || null,
      Email: email.trim() || null,
      Telefone: telefone.trim() || null,
    });
    setSaving(false);
    if (!ok) {
      alert("Erro ao salvar. Verifique o console.");
      return;
    }
    setNome("");
    setTipo("");
    setEmail("");
    setTelefone("");
    setStatus("pendente");
    setObs("");
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
          const actionLabel = ACTION_LABEL[c.Status];
          const nomeExibido = c.Nome || c.Email || c.Telefone || "Sem nome";
          return (
            <div className={`lead-card ${isFinalizado ? "finalizado" : ""}`} key={c.id}>
              <a
                className="lead-card-head"
                href={`/clientes/${c.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir detalhes em nova aba"
              >
                <div className={`entity-avatar ${isFinalizado ? "finalizado" : ""}`}>
                  {nomeExibido.charAt(0).toUpperCase()}
                </div>
                <div className="entity-meta">
                  <div className="entity-name">{nomeExibido}</div>
                  <div className="entity-info-row">
                    <span className="entity-tipo">{c.Tipo || "—"}</span>
                    {c.Origem && <span className="status-badge status-origem">{ORIGEM_LABEL[c.Origem] ?? c.Origem}</span>}
                    {c.Valor != null && <span className="entity-valor">R$ {c.Valor.toLocaleString("pt-BR")}</span>}
                    <span className={`status-badge ${badge.className}`}>{badge.label}</span>
                  </div>
                </div>
                <span className="lead-open-hint" aria-hidden="true">↗</span>
              </a>

              <div className="lead-card-actions">
                {isFinalizado ? (
                  <button className="entity-action-btn checked" disabled>
                    ✓ Finalizado
                  </button>
                ) : (
                  <button
                    className="entity-action-btn"
                    onClick={() => void avancarStatus(c.id)}
                  >
                    {actionLabel}
                  </button>
                )}
                <button
                  className="lead-delete"
                  title="Excluir cliente"
                  aria-label={`Excluir ${nomeExibido}`}
                  onClick={() => {
                    if (confirm(`Excluir "${nomeExibido}"? Esta ação não pode ser desfeita.`)) {
                      void removerCliente(c.id);
                    }
                  }}
                >
                  ✕
                </button>
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
            <div className="form-row cols-2">
              <label className="form-group">
                <span className="form-label">E-mail</span>
                <input
                  className="form-input"
                  type="email"
                  placeholder="cliente@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Telefone / WhatsApp</span>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="(21) 99999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
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
            <label className="form-group">
              <span className="form-label">Observações / Briefing</span>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Descreva o que o cliente precisa ou o que foi feito…"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
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
