"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMissoes } from "@/hooks/useMissoes";
import { useMembros } from "@/hooks/useMembros";
import NotificationBell from "./NotificationBell";
import {
  STATUSES,
  PRIORIDADES,
  statusLabel,
  statusBadge,
  prioridadeLabel,
  type Missao,
  type MissaoStatus,
  type MissaoPrioridade,
} from "@/lib/missoes";

type Aba = "empresa" | "propria";
type Filtro = "todas" | MissaoStatus;

function fmtData(prazo: string) {
  return new Date(prazo + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function MissoesBoard() {
  const { nome, userId, sair } = useAuth();
  const uid = userId ?? null;
  const missoes = useMissoes(uid);
  const { membros } = useMembros(uid, nome ?? null);

  const [aba, setAba] = useState<Aba>("empresa");

  return (
    <div>
      <div className="missoes-topbar">
        <div className="missoes-saudacao">
          <span className="missoes-ola">Olá,</span>
          <strong>{nome}</strong>
        </div>
        <div className="missoes-topbar-actions">
          <NotificationBell userId={uid} />
          <button className="missoes-logout" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </div>

      <div className="tab-row missoes-abas">
        <button className={`tab-btn ${aba === "empresa" ? "active" : ""}`} onClick={() => setAba("empresa")}>
          Missões da empresa
        </button>
        <button className={`tab-btn ${aba === "propria" ? "active" : ""}`} onClick={() => setAba("propria")}>
          Minhas missões
        </button>
      </div>

      {aba === "empresa" ? (
        <EmpresaTab missoes={missoes} membros={membros} uid={uid} />
      ) : (
        <PropriaTab missoes={missoes} />
      )}
    </div>
  );
}

/* ─────────────────────────── helpers de UI ─────────────────────────── */

function Stats({ lista }: { lista: Missao[] }) {
  const total = lista.length;
  const andamento = lista.filter((m) => m.Status === "em-andamento").length;
  const concluidas = lista.filter((m) => m.Status === "finalizado").length;
  const aberto = total - concluidas;
  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-label">Total</div>
        <div className="stat-value">{total}</div>
        <div className="stat-desc">missões</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Em aberto</div>
        <div className="stat-value">{aberto}</div>
        <div className="stat-desc">a fazer</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Em andamento</div>
        <div className="stat-value">{andamento}</div>
        <div className="stat-desc">em execução</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Concluídas</div>
        <div className="stat-value">{concluidas}</div>
        <div className="stat-desc">finalizadas ✓</div>
      </div>
    </div>
  );
}

function Filtros({
  lista,
  filtro,
  setFiltro,
}: {
  lista: Missao[];
  filtro: Filtro;
  setFiltro: (f: Filtro) => void;
}) {
  const counts = useMemo(() => {
    const base: Record<string, number> = { todas: lista.length };
    for (const s of STATUSES) base[s.value] = 0;
    for (const m of lista) base[m.Status] = (base[m.Status] ?? 0) + 1;
    return base;
  }, [lista]);
  return (
    <div className="tab-row">
      <button className={`tab-btn ${filtro === "todas" ? "active" : ""}`} onClick={() => setFiltro("todas")}>
        Todas ({counts.todas})
      </button>
      {STATUSES.map((s) => (
        <button
          key={s.value}
          className={`tab-btn ${filtro === s.value ? "active" : ""}`}
          onClick={() => setFiltro(s.value)}
        >
          {s.label} ({counts[s.value] ?? 0})
        </button>
      ))}
    </div>
  );
}

function CardHead({ m, onClick }: { m: Missao; onClick: () => void }) {
  const isDone = m.Status === "finalizado";
  return (
    <div className="entity-card-head" onClick={onClick}>
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
      {m.Prazo && <span className="missoes-prazo">{fmtData(m.Prazo)}</span>}
      <span className="entity-chevron">▾</span>
    </div>
  );
}

/* ─────────────────────────── aba EMPRESA ─────────────────────────── */

function EmpresaTab({
  missoes,
  membros,
  uid,
}: {
  missoes: ReturnType<typeof useMissoes>;
  membros: ReturnType<typeof useMembros>["membros"];
  uid: string | null;
}) {
  const { empresa, loading, addEmpresa, patchEmpresa, removeEmpresa, setStatusEmpresa } = missoes;

  // Login de admin (senha-mestra MISSOES_PASSWORD)
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminRequired, setAdminRequired] = useState(true);
  const [senha, setSenha] = useState("");
  const [logando, setLogando] = useState(false);
  const [loginErro, setLoginErro] = useState("");

  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Form de nova missão (admin)
  const [formOpen, setFormOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState("");
  const [titulo, setTitulo] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [prioridade, setPrioridade] = useState<MissaoPrioridade>("media");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/missoes/auth", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setAdminAuthed(!!data.authed);
      setAdminRequired(data.required !== false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visiveis = filtro === "todas" ? empresa : empresa.filter((m) => m.Status === filtro);

  async function login() {
    setLogando(true);
    setLoginErro("");
    try {
      const res = await fetch("/api/missoes/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAdminAuthed(true);
        setSenha("");
      } else setLoginErro(data.error ?? "Não foi possível entrar.");
    } catch {
      setLoginErro("Falha de conexão.");
    } finally {
      setLogando(false);
    }
  }

  async function logoutAdmin() {
    await fetch("/api/missoes/auth", { method: "DELETE" }).catch(() => {});
    setAdminAuthed(false);
    setFormOpen(false);
  }

  async function salvar() {
    const t = titulo.trim();
    if (!t) {
      setFormErro("Dê um título para a missão.");
      return;
    }
    setSalvando(true);
    setFormErro("");
    const membro = membros.find((mm) => mm.id === responsavelId);
    const r = await addEmpresa({
      Titulo: t,
      Descricao: descricao.trim() || null,
      Responsavel: membro?.nome ?? null,
      Responsavel_id: membro?.id ?? null,
      Prioridade: prioridade,
      Prazo: prazo || null,
    });
    setSalvando(false);
    if (!r.ok) {
      if (r.status === 401) setAdminAuthed(false);
      setFormErro(r.error ?? "Erro ao salvar.");
      return;
    }
    setTitulo("");
    setResponsavelId("");
    setPrioridade("media");
    setPrazo("");
    setDescricao("");
    setFormOpen(false);
  }

  async function mudarStatusAdmin(id: string, status: MissaoStatus) {
    setBusyId(id);
    const r = await patchEmpresa(id, { Status: status });
    if (r.status === 401) setAdminAuthed(false);
    setBusyId(null);
  }

  async function mudarPrioridadeAdmin(id: string, p: MissaoPrioridade) {
    setBusyId(id);
    await patchEmpresa(id, { Prioridade: p });
    setBusyId(null);
  }

  async function reatribuir(id: string, novoId: string) {
    setBusyId(id);
    const membro = membros.find((mm) => mm.id === novoId);
    await patchEmpresa(id, {
      Responsavel_id: membro?.id ?? null,
      Responsavel: membro?.nome ?? null,
    });
    setBusyId(null);
  }

  async function mudarStatusMembro(id: string, status: MissaoStatus) {
    setBusyId(id);
    await setStatusEmpresa(id, status);
    setBusyId(null);
  }

  async function remover(id: string) {
    if (!confirm("Remover esta missão da empresa?")) return;
    setBusyId(id);
    const r = await removeEmpresa(id);
    if (r.status === 401) setAdminAuthed(false);
    setBusyId(null);
  }

  return (
    <div>
      <Stats lista={empresa} />

      {/* Zona de admin (senha-mestra) */}
      {adminRequired && !adminAuthed ? (
        <div className="missoes-login">
          <div className="missoes-login-copy">
            <strong>Gerenciar missões da empresa</strong>
            <span>Só o admin entra aqui com a senha-mestra para criar, atribuir ou remover. Ver é livre pra todos.</span>
          </div>
          <div className="missoes-login-row">
            <input
              className="form-input"
              type="password"
              placeholder="Senha-mestra"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                if (loginErro) setLoginErro("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && senha) void login();
              }}
            />
            <button className="btn-save" onClick={() => void login()} disabled={logando || !senha}>
              {logando ? "Entrando…" : "Entrar como admin"}
            </button>
          </div>
          {loginErro && <p className="missoes-error">{loginErro}</p>}
        </div>
      ) : adminAuthed ? (
        <div className="missoes-manage-bar">
          <span className="missoes-manage-tag">✓ Gerenciando como admin</span>
          <button className="missoes-logout" onClick={() => void logoutAdmin()}>
            Sair do admin
          </button>
        </div>
      ) : (
        <p className="missoes-error" style={{ marginBottom: 16 }}>
          Gerenciamento desativado — defina MISSOES_PASSWORD para habilitar a criação de missões da empresa.
        </p>
      )}

      <Filtros lista={empresa} filtro={filtro} setFiltro={setFiltro} />

      <div className="entity-list">
        {loading && <p className="empty-state">Carregando missões…</p>}
        {!loading && visiveis.length === 0 && (
          <p className="empty-state">
            {empresa.length === 0 ? "Nenhuma missão da empresa ainda." : "Nenhuma missão neste filtro."}
          </p>
        )}
        {visiveis.map((m) => {
          const isOpen = openId === String(m.id);
          const isDone = m.Status === "finalizado";
          const id = String(m.id);
          const souResponsavel = !!uid && m.Responsavel_id === uid;
          const busy = busyId === id;
          return (
            <div className={`entity-card ${isDone ? "finalizado" : ""} ${isOpen ? "open" : ""}`} key={id}>
              <CardHead m={m} onClick={() => setOpenId(isOpen ? null : id)} />
              <div className="entity-body">
                <div className="entity-body-inner">
                  {m.Descricao && (
                    <div className="info-block">
                      <div className="info-block-label">Detalhes</div>
                      <div className="info-block-text">{m.Descricao}</div>
                    </div>
                  )}

                  {adminAuthed ? (
                    <div className="missoes-controls">
                      <label className="form-group">
                        <span className="form-label">Status</span>
                        <select
                          className="form-select"
                          value={m.Status}
                          disabled={busy}
                          onChange={(e) => void mudarStatusAdmin(id, e.target.value as MissaoStatus)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="form-group">
                        <span className="form-label">Prioridade</span>
                        <select
                          className="form-select"
                          value={m.Prioridade}
                          disabled={busy}
                          onChange={(e) => void mudarPrioridadeAdmin(id, e.target.value as MissaoPrioridade)}
                        >
                          {PRIORIDADES.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="form-group">
                        <span className="form-label">Responsável</span>
                        <select
                          className="form-select"
                          value={m.Responsavel_id ?? ""}
                          disabled={busy}
                          onChange={(e) => void reatribuir(id, e.target.value)}
                        >
                          <option value="">— ninguém —</option>
                          {membros.map((mm) => (
                            <option key={mm.id} value={mm.id}>{mm.nome}</option>
                          ))}
                        </select>
                      </label>
                      <button className="btn-cancel missoes-remove" disabled={busy} onClick={() => void remover(id)}>
                        Remover
                      </button>
                    </div>
                  ) : souResponsavel ? (
                    <div className="missoes-controls">
                      <label className="form-group">
                        <span className="form-label">Seu status nesta missão</span>
                        <select
                          className="form-select"
                          value={m.Status}
                          disabled={busy}
                          onChange={(e) => void mudarStatusMembro(id, e.target.value as MissaoStatus)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </label>
                      <span className="missoes-hint">Esta missão é sua — você pode mover o status.</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {adminAuthed && (
        <>
          <button className="add-btn" onClick={() => setFormOpen((v) => !v)}>
            ＋ Nova missão da empresa
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
                      if (formErro) setFormErro("");
                    }}
                  />
                </label>
                <div className="form-row cols-2">
                  <label className="form-group">
                    <span className="form-label">Responsável (sócio)</span>
                    <select
                      className="form-select"
                      value={responsavelId}
                      onChange={(e) => setResponsavelId(e.target.value)}
                    >
                      <option value="">— escolher depois —</option>
                      {membros.map((mm) => (
                        <option key={mm.id} value={mm.id}>{mm.nome}</option>
                      ))}
                    </select>
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
                  <input className="form-input" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
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
                {formErro && <p className="missoes-error">{formErro}</p>}
                <div className="form-actions">
                  <button className="btn-cancel" onClick={() => setFormOpen(false)}>Cancelar</button>
                  <button className="btn-save" onClick={() => void salvar()} disabled={salvando}>
                    {salvando ? "Salvando…" : "Salvar missão"}
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

/* ─────────────────────────── aba MINHAS MISSÕES ─────────────────────────── */

function PropriaTab({ missoes }: { missoes: ReturnType<typeof useMissoes> }) {
  const { proprias, loading, addPropria, patchPropria, removePropria } = missoes;

  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState("");
  const [titulo, setTitulo] = useState("");
  const [prioridade, setPrioridade] = useState<MissaoPrioridade>("media");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");

  const visiveis = filtro === "todas" ? proprias : proprias.filter((m) => m.Status === filtro);

  async function salvar() {
    const t = titulo.trim();
    if (!t) {
      setFormErro("Dê um título para a missão.");
      return;
    }
    setSalvando(true);
    setFormErro("");
    const r = await addPropria({
      Titulo: t,
      Descricao: descricao.trim() || null,
      Prioridade: prioridade,
      Prazo: prazo || null,
    });
    setSalvando(false);
    if (!r.ok) {
      setFormErro(r.error ?? "Erro ao salvar.");
      return;
    }
    setTitulo("");
    setPrioridade("media");
    setPrazo("");
    setDescricao("");
    setFormOpen(false);
  }

  async function mudarStatus(id: string, status: MissaoStatus) {
    setBusyId(id);
    await patchPropria(id, { Status: status });
    setBusyId(null);
  }
  async function mudarPrioridade(id: string, p: MissaoPrioridade) {
    setBusyId(id);
    await patchPropria(id, { Prioridade: p });
    setBusyId(null);
  }
  async function remover(id: string) {
    if (!confirm("Remover esta missão?")) return;
    setBusyId(id);
    await removePropria(id);
    setBusyId(null);
  }

  return (
    <div>
      <p className="phase-desc missoes-privado-aviso">
        🔒 Sua área privada. Só você vê e organiza estas missões — ninguém mais da equipe tem acesso.
      </p>

      <Stats lista={proprias} />
      <Filtros lista={proprias} filtro={filtro} setFiltro={setFiltro} />

      <div className="entity-list">
        {loading && <p className="empty-state">Carregando…</p>}
        {!loading && visiveis.length === 0 && (
          <p className="empty-state">
            {proprias.length === 0
              ? "Você ainda não criou missões próprias. Use “+ Nova missão minha”."
              : "Nenhuma missão neste filtro."}
          </p>
        )}
        {visiveis.map((m) => {
          const isOpen = openId === String(m.id);
          const isDone = m.Status === "finalizado";
          const id = String(m.id);
          const busy = busyId === id;
          return (
            <div className={`entity-card ${isDone ? "finalizado" : ""} ${isOpen ? "open" : ""}`} key={id}>
              <CardHead m={m} onClick={() => setOpenId(isOpen ? null : id)} />
              <div className="entity-body">
                <div className="entity-body-inner">
                  {m.Descricao && (
                    <div className="info-block">
                      <div className="info-block-label">Detalhes</div>
                      <div className="info-block-text">{m.Descricao}</div>
                    </div>
                  )}
                  <div className="missoes-controls">
                    <label className="form-group">
                      <span className="form-label">Status</span>
                      <select
                        className="form-select"
                        value={m.Status}
                        disabled={busy}
                        onChange={(e) => void mudarStatus(id, e.target.value as MissaoStatus)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="form-group">
                      <span className="form-label">Prioridade</span>
                      <select
                        className="form-select"
                        value={m.Prioridade}
                        disabled={busy}
                        onChange={(e) => void mudarPrioridade(id, e.target.value as MissaoPrioridade)}
                      >
                        {PRIORIDADES.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </label>
                    <button className="btn-cancel missoes-remove" disabled={busy} onClick={() => void remover(id)}>
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="add-btn" onClick={() => setFormOpen((v) => !v)}>
        ＋ Nova missão minha
      </button>
      <div className={`add-form ${formOpen ? "open" : ""}`}>
        <div className="add-form-inner">
          <div className="add-form-card">
            <label className="form-group">
              <span className="form-label">Missão</span>
              <input
                className="form-input"
                placeholder="O que você quer organizar?"
                maxLength={160}
                value={titulo}
                onChange={(e) => {
                  setTitulo(e.target.value);
                  if (formErro) setFormErro("");
                }}
              />
            </label>
            <div className="form-row cols-2">
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
              <label className="form-group">
                <span className="form-label">Prazo (opcional)</span>
                <input className="form-input" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </label>
            </div>
            <label className="form-group">
              <span className="form-label">Detalhes (opcional)</span>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Notas, passos, links…"
                maxLength={2000}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </label>
            {formErro && <p className="missoes-error">{formErro}</p>}
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setFormOpen(false)}>Cancelar</button>
              <button className="btn-save" onClick={() => void salvar()} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar missão"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
