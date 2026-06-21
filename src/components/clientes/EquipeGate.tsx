"use client";

import { useState, type ReactNode } from "react";
import { useVendedor } from "@/hooks/useVendedor";

/** Protege a área de Clientes: exige nome + senha da equipe antes de entrar. */
export default function EquipeGate({ children }: { children: ReactNode }) {
  const { vendedor } = useVendedor();

  if (vendedor === undefined) {
    return (
      <main className="inner">
        <p className="empty-state">Carregando…</p>
      </main>
    );
  }
  if (!vendedor) return <EquipeLogin />;
  return <>{children}</>;
}

function EquipeLogin() {
  const { entrar } = useVendedor();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    const err = await entrar(nome, senha);
    setCarregando(false);
    if (err) setErro(err);
  }

  return (
    <main className="inner equipe-login">
      <div className="page-header">
        <span className="section-eyebrow">Área da equipe</span>
        <h1 className="page-heading">
          Entrar nos <span className="text-gradient">Clientes</span>
        </h1>
        <p className="page-sub">Identifique-se para ver e atender os clientes.</p>
      </div>

      <form className="equipe-form" onSubmit={onSubmit}>
        <label className="form-group">
          <span className="form-label">Seu nome</span>
          <input
            className="form-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como você aparece pra equipe"
            autoComplete="name"
          />
        </label>
        <label className="form-group">
          <span className="form-label">Senha da equipe</span>
          <input
            className="form-input"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
        {erro && <p className="equipe-erro">{erro}</p>}
        <button className="btn-save" type="submit" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
