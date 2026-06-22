"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import {
  normalizeMissao,
  type Missao,
  type MissaoStatus,
  type MissaoPrioridade,
  type NovaMissao,
  type NovaMissaoPropria,
} from "@/lib/missoes";

type Result = { ok: boolean; error?: string; status?: number };

/**
 * Lê as missões com o client AUTENTICADO (Supabase Auth). Por causa da RLS,
 * cada membro recebe: todas as de empresa + só as PRÓPRIAS dele.
 *
 * Escrita:
 *  • Missões de EMPRESA: criar/editar/remover passa pelas rotas server-side
 *    protegidas pela senha-mestra (MISSOES_PASSWORD). Já o membro designado
 *    move o STATUS da SUA direto pelo client (RLS permite).
 *  • Missões PRÓPRIAS: tudo direto pelo client autenticado (RLS isola por dono).
 */
export function useMissoes(userId: string | null | undefined) {
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from("Missoes")
      .select("*")
      .order("Criado_em", { ascending: false });
    if (error) {
      console.error("[missoes] leitura falhou:", error.message);
      return;
    }
    setMissoes((data ?? []).map((r) => normalizeMissao(r as Record<string, unknown>)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, userId]);

  const empresa = missoes.filter((m) => m.Tipo === "empresa");
  const proprias = missoes.filter((m) => m.Tipo === "propria");

  // ───── Missões de empresa (admin, via rota server-side + senha-mestra) ─────
  const addEmpresa = useCallback(async (dados: NovaMissao): Promise<Result> => {
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

  const patchEmpresa = useCallback(
    async (
      id: number | string,
      patch: Partial<{
        Status: MissaoStatus;
        Prioridade: MissaoPrioridade;
        Responsavel: string | null;
        Responsavel_id: string | null;
      }>
    ): Promise<Result> => {
      const res = await fetch(`/api/missoes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.missao) {
        setMissoes((prev) =>
          prev.map((m) => (String(m.id) === String(id) ? normalizeMissao(json.missao) : m))
        );
      }
      return { ok: res.ok, error: json.error, status: res.status };
    },
    []
  );

  const removeEmpresa = useCallback(async (id: number | string): Promise<Result> => {
    const res = await fetch(`/api/missoes/${id}`, { method: "DELETE" });
    if (res.ok) setMissoes((prev) => prev.filter((m) => String(m.id) !== String(id)));
    return { ok: res.ok, status: res.status };
  }, []);

  // ───── Membro move o status da missão de empresa que é DELE (RLS) ─────
  const setStatusEmpresa = useCallback(
    async (id: number | string, Status: MissaoStatus): Promise<Result> => {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("Missoes")
        .update({ Status })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "Não foi possível atualizar." };
      }
      setMissoes((prev) =>
        prev.map((m) =>
          String(m.id) === String(id) ? normalizeMissao(data as Record<string, unknown>) : m
        )
      );
      return { ok: true };
    },
    []
  );

  // ───── Missões próprias (membro, via client autenticado / RLS) ─────
  const addPropria = useCallback(
    async (dados: NovaMissaoPropria): Promise<Result> => {
      if (!userId) return { ok: false, error: "Faça login para criar missões." };
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("Missoes")
        .insert({
          Titulo: dados.Titulo,
          Descricao: dados.Descricao,
          Prioridade: dados.Prioridade,
          Prazo: dados.Prazo,
          Status: "pendente",
          Tipo: "propria",
          Owner_id: userId,
        })
        .select()
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? "Erro ao salvar." };
      setMissoes((prev) => [normalizeMissao(data as Record<string, unknown>), ...prev]);
      return { ok: true };
    },
    [userId]
  );

  const patchPropria = useCallback(
    async (
      id: number | string,
      patch: Partial<{
        Status: MissaoStatus;
        Prioridade: MissaoPrioridade;
        Titulo: string;
        Descricao: string | null;
        Prazo: string | null;
      }>
    ): Promise<Result> => {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("Missoes")
        .update(patch)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error || !data) return { ok: false, error: error?.message ?? "Erro ao atualizar." };
      setMissoes((prev) =>
        prev.map((m) =>
          String(m.id) === String(id) ? normalizeMissao(data as Record<string, unknown>) : m
        )
      );
      return { ok: true };
    },
    []
  );

  const removePropria = useCallback(async (id: number | string): Promise<Result> => {
    const sb = await getSupabase();
    const { error } = await sb.from("Missoes").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    setMissoes((prev) => prev.filter((m) => String(m.id) !== String(id)));
    return { ok: true };
  }, []);

  return {
    empresa,
    proprias,
    loading,
    refresh,
    addEmpresa,
    patchEmpresa,
    removeEmpresa,
    setStatusEmpresa,
    addPropria,
    patchPropria,
    removePropria,
  };
}
