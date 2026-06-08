"use client";

import { useCallback, useEffect, useState } from "react";
import { sbGet, sbInsert } from "@/lib/supabase";

export interface Avaliacao {
  id: number | string;
  Projeto: string;
  Revisor: string;
  Código: number;
  Design: number;
  Segurança: number;
  Prazo: number;
  Media: number;
  "Obs.": string | null;
}

export interface NovaAvaliacao {
  Projeto: string;
  Revisor: string;
  Código: number;
  Design: number;
  Segurança: number;
  Prazo: number;
  Media: number;
  "Obs.": string | null;
}

export function useAvaliacoes() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await sbGet<Avaliacao>("Revision");
      if (cancelled) return;
      setAvaliacoes(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addAvaliacao = useCallback(async (dados: NovaAvaliacao) => {
    const salvo = await sbInsert<Avaliacao>("Revision", dados);
    if (!salvo) return false;
    setAvaliacoes((prev) => [...prev, salvo]);
    return true;
  }, []);

  return { avaliacoes, addAvaliacao };
}
