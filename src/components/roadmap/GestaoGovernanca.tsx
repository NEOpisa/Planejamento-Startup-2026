"use client";

import { useState } from "react";
import { GESTORES, GOVERNANCA, GOV_METAS } from "@/lib/roadmap-data";
import { catSolid } from "@/lib/cat-colors";

type View = "gestao" | "gov";

export default function GestaoGovernanca() {
  const [view, setView] = useState<View>("gestao");

  return (
    <section>
      <div className="block-label">{"// gestão & governança"}</div>
      <div className="tab-row">
        <button className={`tab-btn ${view === "gestao" ? "active" : ""}`} onClick={() => setView("gestao")}>
          Gestão
        </button>
        <button className={`tab-btn ${view === "gov" ? "active" : ""}`} onClick={() => setView("gov")}>
          Governança
        </button>
      </div>

      {view === "gestao" ? (
        <div className="gestao-grid">
          {GESTORES.map((g) => (
            <div className="gestao-card" key={g.name}>
              <div className="gestao-card-head">
                <div className="gestao-avatar" style={{ background: catSolid(g.color) }}>
                  {g.initial}
                </div>
                <div>
                  <div className="gestao-name">{g.name}</div>
                  <div className="gestao-titulo">{g.titulo}</div>
                </div>
              </div>
              {g.blocks.map((block) => (
                <div key={block.label}>
                  <div className="gestao-block-label">{block.label}</div>
                  <div className="gestao-block-text">{block.text}</div>
                </div>
              ))}
              <div className="gestao-tags">
                {g.tags.map((tag) => (
                  <span className="gestao-tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="gov-list">
            {GOVERNANCA.map((item, i) => (
              <div className="gov-item" key={i}>
                <span className="gov-icon">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <div className="meta-grid">
            {GOV_METAS.map((meta) => (
              <div className="meta-card" key={meta.label}>
                <div className="meta-label">{meta.label}</div>
                <div className="meta-value">{meta.value}</div>
                <div className="meta-desc">{meta.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
