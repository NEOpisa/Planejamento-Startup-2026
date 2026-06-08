"use client";

import { useCallback, useEffect, useState } from "react";
import { sbGet, sbUpsert, taskId } from "@/lib/supabase";

interface TarefaRow {
  id: string;
  done: boolean;
}

/**
 * Carrega o estado de conclusão das tarefas do roadmap (tabela `Tarefas`)
 * e expõe um toggle que persiste via upsert — mesma lógica do site original,
 * onde o id da tarefa é derivado do texto exibido (ver `taskId`).
 */
export function useTarefas() {
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tarefas = await sbGet<TarefaRow>("Tarefas", "select=id,done");
      if (cancelled || !tarefas.length) return;
      const map: Record<string, boolean> = {};
      tarefas.forEach((t) => {
        map[t.id] = t.done;
      });
      setDoneMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((texto: string) => {
    const id = taskId(texto);
    setDoneMap((prev) => {
      const done = !prev[id];
      void sbUpsert("Tarefas", { id, done });
      return { ...prev, [id]: done };
    });
  }, []);

  return { doneMap, toggle };
}
