"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

function nomeDe(u: User | null): string | null {
  if (!u) return null;
  const meta = u.user_metadata as { nome?: string } | undefined;
  return meta?.nome || u.email || null;
}

function traduzir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Esse e-mail já tem conta. Faça login.";
  if (m.includes("password") && m.includes("6")) return "A senha precisa de ao menos 6 caracteres.";
  if (m.includes("email") && m.includes("valid")) return "E-mail inválido.";
  return msg;
}

export function useAuth() {
  // undefined = carregando a sessão; null = deslogado; User = logado
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const entrar = useCallback(async (email: string, senha: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    return error ? traduzir(error.message) : null;
  }, []);

  const cadastrar = useCallback(
    async (nome: string, email: string, senha: string): Promise<string | null> => {
      const n = nome.trim();
      if (!n) return "Informe o seu nome.";
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: { data: { nome: n } },
      });
      return error ? traduzir(error.message) : null;
    },
    []
  );

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    usuario: user,
    vendedor: user === undefined ? undefined : nomeDe(user),
    entrar,
    cadastrar,
    sair,
  };
}
