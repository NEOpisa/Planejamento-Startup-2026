"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

export interface Notificacao {
  id: number;
  missao_id: number | null;
  titulo: string;
  corpo: string | null;
  tipo: string;
  lida: boolean;
  criado_em: string;
}

const POLL_MS = 30_000;

/**
 * Sino de notificações do membro logado. Lê da tabela Notificacoes (RLS já
 * limita ao próprio usuário), faz polling a cada 30s e dispara uma notificação
 * do navegador quando chega algo novo enquanto a aba está aberta.
 */
export function useNotificacoes(userId: string | null | undefined) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const conhecidasRef = useRef<Set<number>>(new Set());
  const primeiraCargaRef = useRef(true);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  const carregar = useCallback(async () => {
    if (!userId) return;
    const sb = await getSupabase();
    const { data, error } = await sb
      .from("Notificacoes")
      .select("id,missao_id,titulo,corpo,tipo,lida,criado_em")
      .order("criado_em", { ascending: false })
      .limit(50);
    if (error || !data) return;

    const lista = data as Notificacao[];

    // Dispara aviso do navegador pras notificações novas (menos na 1ª carga).
    if (!primeiraCargaRef.current) {
      for (const n of lista) {
        if (!conhecidasRef.current.has(n.id) && !n.lida) {
          dispararAvisoNavegador(n.titulo, n.corpo);
        }
      }
    }
    conhecidasRef.current = new Set(lista.map((n) => n.id));
    primeiraCargaRef.current = false;
    setNotificacoes(lista);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    primeiraCargaRef.current = true;
    conhecidasRef.current = new Set();
    const tick = () => {
      if (!cancelled) void carregar();
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [userId, carregar]);

  const marcarLida = useCallback(async (id: number) => {
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    const sb = await getSupabase();
    await sb.from("Notificacoes").update({ lida: true }).eq("id", id);
  }, []);

  const marcarTodasLidas = useCallback(async () => {
    const ids = notificacoes.filter((n) => !n.lida).map((n) => n.id);
    if (ids.length === 0) return;
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    const sb = await getSupabase();
    await sb.from("Notificacoes").update({ lida: true }).in("id", ids);
  }, [notificacoes]);

  const pedirPermissao = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
  }, []);

  return { notificacoes, naoLidas, marcarLida, marcarTodasLidas, pedirPermissao, recarregar: carregar };
}

function dispararAvisoNavegador(titulo: string, corpo: string | null) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(titulo, { body: corpo ?? undefined, icon: "/favicon.ico" });
  } catch {
    /* ignore */
  }
}
