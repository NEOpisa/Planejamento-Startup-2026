"use client";

import { useCallback, useEffect, useState } from "react";
import { sbGet } from "@/lib/supabase";
import {
  normalizeMissao,
  type Missao,
  type MissaoStatus,
  type NovaMissao,
} from "@/lib/missoes";

type Result = { ok: boolean; error?: string; status?: number };

/**
 * Leitura pública via sbGet (mesmo padrão de useClientes/useTarefas).
 * Escrita (add/status/remover) passa pelas rotas server-side protegidas por
 * login — por isso retorna o status HTTP, pra UI tratar 401 (sessão expirada).
 */
export function useMissoes() {
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await sbGet<Record<string, unknown>>("Missoes", "order=Criado_em.desc");
      if (cancelled) return;
      setMissoes(data.map(normalizeMissao));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addMissao = useCallback(async (dados: NovaMissao): Promise<Result> => {
    const res = await fetch("/api/missoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.missao) {
      setMissoes((prev) => [normalizeMissao(json.missao), ...prev]);
      return { ok: true };
    }
    return { ok: false, error: json.error ?? "Erro ao salvar.", status: res.status };
  }, []);

  const updateStatus = useCallback(async (id: number | string, Status: MissaoStatus): Promise<Result> => {
    const res = await fetch(`/api/missoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Status }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.missao) {
      setMissoes((prev) => prev.map((m) => (String(m.id) === String(id) ? normalizeMissao(json.missao) : m)));
    }
    return { ok: res.ok, status: res.status };
  }, []);

  const removeMissao = useCallback(async (id: number | string): Promise<Result> => {
    const res = await fetch(`/api/missoes/${id}`, { method: "DELETE" });
    if (res.ok) setMissoes((prev) => prev.filter((m) => String(m.id) !== String(id)));
    return { ok: res.ok, status: res.status };
  }, []);

  return { missoes, loading, addMissao, updateStatus, removeMissao };
}
