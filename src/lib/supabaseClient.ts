"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Inicializa o client do Supabase Auth a partir do /api/config (mesma fonte
// que o resto do app já usa: SUPABASE_URL + publishable key). Assim o login
// funciona com as envs que já existem na Vercel — sem precisar de NEXT_PUBLIC_*.
let cached: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  if (!cached) {
    cached = fetch("/api/config")
      .then((r) => {
        if (!r.ok) throw new Error("config indisponível");
        return r.json();
      })
      .then(({ url, key }: { url: string; key: string }) =>
        createClient(url, key, {
          auth: { persistSession: true, autoRefreshToken: true },
        })
      );
  }
  return cached;
}
