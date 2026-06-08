"use client";

import { useState } from "react";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";

function clamp(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.min(10, Math.max(0, v));
}

export default function AvaliacaoPanel() {
  const { avaliacoes, addAvaliacao } = useAvaliacoes();
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projeto, setProjeto] = useState("");
  const [revisor, setRevisor] = useState("");
  const [codigo, setCodigo] = useState("");
  const [design, setDesign] = useState("");
  const [seguranca, setSeguranca] = useState("");
  const [prazo, setPrazo] = useState("");
  const [obs, setObs] = useState("");

  async function handleSubmit() {
    const projetoTrim = projeto.trim();
    if (!projetoTrim) {
      alert("Informe o nome do projeto.");
      return;
    }
    const c = clamp(parseFloat(codigo));
    const d = clamp(parseFloat(design));
    const s = clamp(parseFloat(seguranca));
    const p = clamp(parseFloat(prazo));
    const media = parseFloat(((c + d + s + p) / 4).toFixed(1));

    setSaving(true);
    const ok = await addAvaliacao({
      Projeto: projetoTrim,
      Revisor: revisor.trim() || "Equipe",
      Código: c,
      Design: d,
      Segurança: s,
      Prazo: p,
      Media: media,
      "Obs.": obs.trim() || null,
    });
    setSaving(false);
    if (!ok) {
      alert("Erro ao salvar. Verifique o console.");
      return;
    }
    setProjeto("");
    setRevisor("");
    setCodigo("");
    setDesign("");
    setSeguranca("");
    setPrazo("");
    setObs("");
    setFormOpen(false);
  }

  return (
    <div>
      <div className="entity-list">
        {avaliacoes.length === 0 && (
          <p className="empty-state">
            Nenhuma avaliação registrada ainda. Clique em &quot;+ Nova avaliação técnica&quot; para adicionar.
          </p>
        )}
        {avaliacoes.map((a) => {
          const isOpen = openId === String(a.id);
          return (
            <div className={`entity-card ${isOpen ? "open" : ""}`} key={a.id}>
              <div className="entity-card-head" onClick={() => setOpenId(isOpen ? null : String(a.id))}>
                <div className="entity-avatar">{(a.Projeto || "?").charAt(0).toUpperCase()}</div>
                <div className="entity-meta">
                  <div className="entity-name">{a.Projeto}</div>
                  <div className="entity-info-row">
                    <span className="entity-tipo">Avaliador: {a.Revisor || "Equipe"}</span>
                  </div>
                </div>
                <span className="entity-media">{a.Media.toFixed(1)} / 10</span>
                <span className="entity-chevron">▾</span>
              </div>
              <div className="entity-body">
                <div className="entity-body-inner">
                  <div className="score-grid">
                    <div className="score-item">
                      <div className="score-label">Código</div>
                      <div className="score-value">{a.Código}</div>
                    </div>
                    <div className="score-item">
                      <div className="score-label">Design</div>
                      <div className="score-value">{a.Design}</div>
                    </div>
                    <div className="score-item">
                      <div className="score-label">Segurança</div>
                      <div className="score-value">{a.Segurança}</div>
                    </div>
                    <div className="score-item">
                      <div className="score-label">Prazo</div>
                      <div className="score-value">{a.Prazo}</div>
                    </div>
                  </div>
                  {a["Obs."] && (
                    <div className="info-block">
                      <div className="info-block-label">Observações técnicas</div>
                      <div className="info-block-text">{a["Obs."]}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="add-btn" onClick={() => setFormOpen((v) => !v)}>
        ＋ Nova avaliação técnica
      </button>

      <div className={`add-form ${formOpen ? "open" : ""}`}>
        <div className="add-form-inner">
          <div className="add-form-card">
            <div className="form-row cols-2">
              <label className="form-group">
                <span className="form-label">Projeto avaliado</span>
                <input
                  className="form-input"
                  placeholder="Nome do projeto"
                  value={projeto}
                  onChange={(e) => setProjeto(e.target.value)}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Avaliador</span>
                <input
                  className="form-input"
                  placeholder="Ex: Mizael"
                  value={revisor}
                  onChange={(e) => setRevisor(e.target.value)}
                />
              </label>
            </div>
            <div className="form-row cols-4">
              <label className="form-group">
                <span className="form-label">Qualidade do código (0–10)</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  max={10}
                  placeholder="0–10"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Design / UI (0–10)</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  max={10}
                  placeholder="0–10"
                  value={design}
                  onChange={(e) => setDesign(e.target.value)}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Segurança (0–10)</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  max={10}
                  placeholder="0–10"
                  value={seguranca}
                  onChange={(e) => setSeguranca(e.target.value)}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Entrega no prazo (0–10)</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  max={10}
                  placeholder="0–10"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                />
              </label>
            </div>
            <label className="form-group">
              <span className="form-label">Observações técnicas</span>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Pontos fortes, o que pode melhorar, notas importantes…"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </label>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setFormOpen(false)}>
                Cancelar
              </button>
              <button className="btn-save" onClick={handleSubmit} disabled={saving}>
                {saving ? "Salvando…" : "Salvar avaliação"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
