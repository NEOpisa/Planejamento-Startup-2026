"use client";

import { useState } from "react";
import type { TaskGroup as TaskGroupData } from "@/lib/roadmap-data";
import { catSolid, catTagStyle } from "@/lib/cat-colors";
import { taskId } from "@/lib/supabase";

export default function TaskGroup({
  group,
  doneMap,
  onToggle,
}: {
  group: TaskGroupData;
  doneMap: Record<string, boolean>;
  onToggle: (texto: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`task-group ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)}>
      <div className="task-group-head">
        <span className="owner-dot" style={{ background: catSolid(group.color) }} />
        <span className="task-group-title">{group.title}</span>
        <span className="task-count">{group.tasks.length} tarefas</span>
        <span className="chevron">▾</span>
      </div>
      <div className="task-items">
        <div className="task-items-inner">
          {group.tasks.map((task) => {
            const done = !!doneMap[taskId(task.text)];
            return (
              <div className="task-item" key={task.text}>
                <span
                  className={`task-check ${done ? "done" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(task.text);
                  }}
                >
                  {done ? "✓" : ""}
                </span>
                <span className={`task-text ${done ? "done" : ""}`}>{task.text}</span>
                <span className="task-tag" style={catTagStyle(group.color)}>
                  {task.tag}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
