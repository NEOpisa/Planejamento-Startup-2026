"use client";

import { createClient } from "@supabase/supabase-js";

// Client de browser para o Supabase Auth (login/cadastro dos vendedores).
// Usa a URL + a publishable/anon key (seguras de expor).
// Fallback p/ placeholder evita quebrar o build quando as envs ainda não
// estão definidas (em produção as NEXT_PUBLIC_ reais entram no bundle).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
