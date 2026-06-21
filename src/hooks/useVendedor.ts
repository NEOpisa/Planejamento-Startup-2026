"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "nvg_vendedor";

/** Vendedor logado (nome) guardado no localStorage, validado pela senha da equipe. */
export function useVendedor() {
  // undefined = ainda lendo o localStorage; null = deslogado; string = logado
  const [vendedor, setVendedor] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setVendedor(localStorage.getItem(KEY));
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setVendedor(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const entrar = useCallback(async (nome: string, senha: string): Promise<string | null> => {
    const n = nome.trim();
    if (!n) return "Informe o seu nome.";
    try {
      const res = await fetch("/api/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (res.status === 401) return "Senha da equipe incorreta.";
      if (!res.ok) return "Não foi possível entrar agora.";
    } catch {
      return "Falha de conexão.";
    }
    localStorage.setItem(KEY, n);
    setVendedor(n);
    return null;
  }, []);

  const sair = useCallback(() => {
    localStorage.removeItem(KEY);
    setVendedor(null);
  }, []);

  return { vendedor, entrar, sair };
}
