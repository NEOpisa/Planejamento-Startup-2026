"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

export interface Membro {
  id: string;
  nome: string;
  email: string | null;
  papel: string;
}

/**
 * Lista os sócios cadastrados (tabela Membros, preenchida no cadastro via
 * trigger). Serve pro admin escolher a quem atribuir uma missão de empresa.
 * Também garante que o próprio perfil exista (upsert), caso a conta tenha sido
 * criada antes do trigger.
 */
export function useMembros(userId: string | null | undefined, nome: string | null | undefined) {
  const [membros, setMembros] = useState<Membro[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = await getSupabase();

      // Garante o próprio perfil (idempotente; RLS só deixa mexer no próprio).
      if (userId) {
        try {
          await sb
            .from("Membros")
            .upsert({ id: userId, nome: nome ?? null }, { onConflict: "id", ignoreDuplicates: true });
        } catch {
          /* perfil já existe ou trigger cuidou — segue */
        }
      }

      const { data, error } = await sb
        .from("Membros")
        .select("id,nome,email,papel")
        .order("nome", { ascending: true });
      if (cancelled || error) return;
      setMembros(
        (data ?? []).map((m) => ({
          id: m.id as string,
          nome: (m.nome as string) || (m.email as string) || "Sem nome",
          email: (m.email as string) ?? null,
          papel: (m.papel as string) ?? "membro",
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, nome]);

  return { membros };
}
