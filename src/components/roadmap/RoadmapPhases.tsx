"use client";

import { useState } from "react";
import { PHASES } from "@/lib/roadmap-data";
import { useTarefas } from "@/hooks/useTarefas";
import TaskGroup from "./TaskGroup";

export default function RoadmapPhases() {
  const [activeId, setActiveId] = useState(PHASES[0].id);
  const { doneMap, toggle } = useTarefas();
  const phase = PHASES.find((p) => p.id === activeId) ?? PHASES[0];

  return (
    <section>
      <div className="block-label">{"// roadmap por fase"}</div>
      <div className="tab-row">
        {PHASES.map((p) => (
          <button
            key={p.id}
            className={`tab-btn ${p.id === activeId ? "active" : ""}`}
            onClick={() => setActiveId(p.id)}
          >
            Fase {p.number} · {p.short}
          </button>
        ))}
      </div>

      <div className="phase-head">
        <div className="phase-number">{phase.number}</div>
        <div>
          <span className="phase-timeline">{phase.timeline}</span>
          <h2 className="phase-title">{phase.title}</h2>
          <p className="phase-desc">{phase.description}</p>
        </div>
      </div>

      <div className="tasks">
        {phase.groups.map((group) => (
          <TaskGroup key={group.title} group={group} doneMap={doneMap} onToggle={toggle} />
        ))}
      </div>

      <div className="meta-grid">
        {phase.metas.map((meta) => (
          <div className="meta-card" key={meta.label}>
            <div className="meta-label">{meta.label}</div>
            <div className="meta-value">{meta.value}</div>
            <div className="meta-desc">{meta.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
