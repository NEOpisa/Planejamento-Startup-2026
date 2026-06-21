"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

/** Protege a área de Clientes com Supabase Auth (conta por vendedor). */
export default function EquipeGate({ children }: { children: ReactNode }) {
  const { vendedor } = useAuth();

  if (vendedor === undefined) {
    return (
      <main className="inner">
        <p className="empty-state">Carregando…</p>
      </main>
    );
  }
  if (!vendedor) return <AuthForm />;
  return <>{children}</>;
}

function AuthForm() {
  const { entrar, cadastrar } = useAuth();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    setAviso("");
    const err =
      modo === "entrar"
        ? await entrar(email, senha)
        : await cadastrar(nome, email, senha);
    setCarregando(false);
    if (err) {
      setErro(err);
      return;
    }
    if (modo === "cadastrar") {
      // Se a confirmação de e-mail estiver ligada, ainda não há sessão.
      setAviso("Conta criada! Se pedirmos confirmação, confira seu e-mail. Senão, é só entrar.");
      setModo("entrar");
      setSenha("");
    }
  }

  return (
    <main className="inner equipe-login">
      <div className="page-header">
        <span className="section-eyebrow">Área da equipe</span>
        <h1 className="page-heading">
          {modo === "entrar" ? "Entrar" : "Criar conta"} nos{" "}
          <span className="text-gradient">Clientes</span>
        </h1>
        <p className="page-sub">
          {modo === "entrar"
            ? "Acesse com sua conta para ver e atender os clientes."
            : "Cadastre-se para atender os clientes em nome próprio."}
        </p>
      </div>

      <form className="equipe-form" onSubmit={onSubmit}>
        {modo === "cadastrar" && (
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
        )}
        <label className="form-group">
          <span className="form-label">E-mail</span>
          <input
            className="form-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            autoComplete="email"
          />
        </label>
        <label className="form-group">
          <span className="form-label">Senha</span>
          <input
            className="form-input"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
          />
        </label>

        {erro && <p className="equipe-erro">{erro}</p>}
        {aviso && <p className="equipe-aviso">{aviso}</p>}

        <button className="btn-save" type="submit" disabled={carregando}>
          {carregando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>

        <button
          type="button"
          className="equipe-toggle"
          onClick={() => {
            setModo((m) => (m === "entrar" ? "cadastrar" : "entrar"));
            setErro("");
            setAviso("");
          }}
        >
          {modo === "entrar" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </form>
    </main>
  );
}
