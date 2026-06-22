"use client";

import { useEffect, useMemo, useState } from "react";
import { useMissoes } from "@/hooks/useMissoes";
import {
  STATUSES,
  PRIORIDADES,
  statusLabel,
  statusBadge,
  prioridadeLabel,
  type MissaoStatus,
  type MissaoPrioridade,
} from "@/lib/missoes";

type Filter = "todas" | MissaoStatus;

export default function MissoesBoard() {
  const { missoes, loading, addMissao, updateStatus, removeMissao } = useMissoes();

  // Login (só para gerenciar)
  const [authed, setAuthed] = useState(false);
  const [authRequired, setAuthRequired] = useState(true);
  const [senha, setSenha] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Formulário de nova missão
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [titulo, setTitulo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prioridade, setPrioridade] = useState<MissaoPrioridade>("media");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");

  const [filter, setFilter] = useState<Filter>("todas");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/missoes/auth", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setAuthed(!!data.authed);
      setAuthRequired(data.required !== false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const base: Record<string, number> = { todas: missoes.length };
    for (const s of STATUSES) base[s.value] = 0;
    for (const m of missoes) base[m.Status] = (base[m.Status] ?? 0) + 1;
    return base;
  }, [missoes]);

  const visiveis = filter === "todas" ? missoes : missoes.filter((m) => m.Status === filter);

  async function handleLogin() {
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/missoes/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAuthed(true);
        setSenha("");
      } else {
        setLoginError(data.error ?? "Não foi possível entrar.");
      }
    } catch {
      setLoginError("Falha de conexão ao entrar.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/missoes/auth", { method: "DELETE" }).catch(() => {});
    setAuthed(false);
    setFormOpen(false);
  }

  async function handleSubmit() {
    const t = titulo.trim();
    if (!t) {
      setFormError("Dê um título para a missão.");
      return;
    }
    setSaving(true);
    setFormError("");
    const r = await addMissao({
      Titulo: t,
      Descricao: descricao.trim() || null,
      Responsavel: responsavel.trim() || null,
      Prioridade: prioridade,
      Prazo: prazo || null,
    });
    setSaving(false);
    if (!r.ok) {
      if (r.status === 401) setAuthed(false);
      setFormError(r.error ?? "Erro ao salvar.");
      return;
    }
    setTitulo("");
    setResponsavel("");
    setPrioridade("media");
    setPrazo("");
    setDescricao("");
    setFormOpen(false);
  }

  async function handleStatus(id: string, status: MissaoStatus) {
    setBusyId(id);
    const r = await updateStatus(id, status);
    if (r.status === 401) setAuthed(false);
    setBusyId(null);
  }

  async function handleRemove(id: string) {
    if (!confirm("Remover esta missão?")) return;
    setBusyId(id);
    const r = await removeMissao(id);
    if (r.status === 401) setAuthed(false);
    setBusyId(null);
  }

  const totalAbertas = (counts["pendente"] ?? 0) + (counts["em-andamento"] ?? 0);

  return (
    <div>
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{counts.todas}</div>
          <div className="stat-desc">missões criadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Em aberto</div>
          <div className="stat-value">{totalAbertas}</div>
          <div className="stat-desc">pendentes + andamento</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Em andamento</div>
          <div className="stat-value">{counts["em-andamento"] ?? 0}</div>
          <div className="stat-desc">em execução</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Concluídas</div>
          <div className="stat-value">{counts["finalizado"] ?? 0}</div>
          <div className="stat-desc">finalizadas ✓</div>
        </div>
      </div>

      {/* Login OU botão de adicionar */}
      {authRequired && !authed ? (
        <div className="missoes-login">
          <div className="missoes-login-copy">
            <strong>Área de gerenciamento</strong>
            <span>Entre para adicionar, mover ou remover missões. A lista abaixo é visível para todos.</span>
          </div>
          <div className="missoes-login-row">
            <input
              className="form-input"
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                if (loginError) setLoginError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && senha) void handleLogin();
              }}
            />
            <button className="btn-save" onClick={() => void handleLogin()} disabled={loggingIn || !senha}>
              {loggingIn ? "Entrando…" : "Entrar"}
            </button>
          </div>
          {loginError && <p className="missoes-error">{loginError}</p>}
        </div>
      ) : authed ? (
        <div className="missoes-manage-bar">
          <span className="missoes-manage-tag">✓ Gerenciando</span>
          <button className="missoes-logout" onClick={() => void handleLogout()}>
            Sair
          </button>
        </div>
      ) : (
        <p className="missoes-error" style={{ marginBottom: 16 }}>
          Gerenciamento desativado — defina MISSOES_PASSWORD para habilitar o login.
        </p>
      )}

      {/* Filtros */}
      <div className="tab-row">
        <button className={`tab-btn ${filter === "todas" ? "active" : ""}`} onClick={() => setFilter("todas")}>
          Todas ({counts.todas})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            className={`tab-btn ${filter === s.value ? "active" : ""}`}
            onClick={() => setFilter(s.value)}
          >
            {s.label} ({counts[s.value] ?? 0})
          </button>
        ))}
      </div>

      <div className="entity-list">
        {loading && <p className="empty-state">Carregando missões…</p>}
        {!loading && visiveis.length === 0 && (
          <p className="empty-state">
            {missoes.length === 0 ? "Nenhuma missão ainda." : "Nenhuma missão neste filtro."}
          </p>
        )}
        {visiveis.map((m) => {
          const isOpen = openId === String(m.id);
          const isDone = m.Status === "finalizado";
          return (
            <div className={`entity-card ${isDone ? "finalizado" : ""} ${isOpen ? "open" : ""}`} key={m.id}>
              <div className="entity-card-head" onClick={() => setOpenId(isOpen ? null : String(m.id))}>
                <div className={`entity-avatar ${isDone ? "finalizado" : ""}`}>
                  {(m.Titulo || "?").charAt(0).toUpperCase()}
                </div>
                <div className="entity-meta">
                  <div className="entity-name">{m.Titulo}</div>
                  <div className="entity-info-row">
                    <span className={`prio-badge prio-${m.Prioridade}`}>{prioridadeLabel(m.Prioridade)}</span>
                    <span className={`status-badge ${statusBadge(m.Status)}`}>{statusLabel(m.Status)}</span>
                    {m.Responsavel && <span className="entity-tipo">{m.Responsavel}</span>}
                  </div>
                </div>
                {m.Prazo && <span className="missoes-prazo">{new Date(m.Prazo + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                <span className="entity-chevron">▾</span>
              </div>
              <div className="entity-body">
                <div className="entity-body-inner">
                  {m.Descricao && (
                    <div className="info-block">
                      <div className="info-block-label">Detalhes</div>
                      <div className="info-block-text">{m.Descricao}</div>
                    </div>
                  )}
                  {authed && (
                    <div className="missoes-controls">
                      <label className="form-group">
                        <span className="form-label">Status</span>
                        <select
                          className="form-select"
                          value={m.Status}
                          disabled={busyId === String(m.id)}
                          onChange={(e) => void handleStatus(String(m.id), e.target.value as MissaoStatus)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="btn-cancel missoes-remove"
                        disabled={busyId === String(m.id)}
                        onClick={() => void handleRemove(String(m.id))}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {authed && (
        <>
          <button className="add-btn" onClick={() => setFormOpen((v) => !v)}>
            ＋ Nova missão
          </button>
          <div className={`add-form ${formOpen ? "open" : ""}`}>
            <div className="add-form-inner">
              <div className="add-form-card">
                <label className="form-group">
                  <span className="form-label">Missão</span>
                  <input
                    className="form-input"
                    placeholder="O que precisa ser feito?"
                    maxLength={160}
                    value={titulo}
                    onChange={(e) => {
                      setTitulo(e.target.value);
                      if (formError) setFormError("");
                    }}
                  />
                </label>
                <div className="form-row cols-2">
                  <label className="form-group">
                    <span className="form-label">Responsável (sócio)</span>
                    <input
                      className="form-input"
                      placeholder="Quem assume?"
                      maxLength={120}
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                    />
                  </label>
                  <label className="form-group">
                    <span className="form-label">Prioridade</span>
                    <select
                      className="form-select"
                      value={prioridade}
                      onChange={(e) => setPrioridade(e.target.value as MissaoPrioridade)}
                    >
                      {PRIORIDADES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="form-group">
                  <span className="form-label">Prazo (opcional)</span>
                  <input
                    className="form-input"
                    type="date"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Detalhes (opcional)</span>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Contexto, links, critérios de pronto…"
                    maxLength={2000}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </label>
                {formError && <p className="missoes-error">{formError}</p>}
                <div className="form-actions">
                  <button className="btn-cancel" onClick={() => setFormOpen(false)}>
                    Cancelar
                  </button>
                  <button className="btn-save" onClick={() => void handleSubmit()} disabled={saving}>
                    {saving ? "Salvando…" : "Salvar missão"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
