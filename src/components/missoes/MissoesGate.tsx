"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

/** Exige login (Supabase Auth) pra entrar na área de missões — assim o sistema
 *  sabe QUEM está acessando e mostra as missões marcadas pra cada um. */
export default function MissoesGate({ children }: { children: ReactNode }) {
  const { nome } = useAuth();

  if (nome === undefined) {
    return (
      <main className="inner">
        <p className="empty-state">Carregando…</p>
      </main>
    );
  }
  if (!nome) return <AuthForm />;
  return <>{children}</>;
}

type Modo = "entrar" | "cadastrar" | "recuperar";

function AuthForm() {
  const { entrar, cadastrar, resetarSenha } = useAuth();
  const [modo, setModo] = useState<Modo>("entrar");
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
    let err: string | null = null;
    if (modo === "entrar") err = await entrar(email, senha);
    else if (modo === "cadastrar") err = await cadastrar(nome, email, senha);
    else err = await resetarSenha(email);
    setCarregando(false);
    if (err) {
      setErro(err);
      return;
    }
    if (modo === "cadastrar") {
      setAviso("Conta criada! Se pedirmos confirmação, confira seu e-mail. Senão, é só entrar.");
      setModo("entrar");
      setSenha("");
    } else if (modo === "recuperar") {
      setAviso("Se o e-mail tiver conta, enviamos um link pra redefinir a senha.");
      setModo("entrar");
    }
  }

  const titulo =
    modo === "entrar" ? "Entrar" : modo === "cadastrar" ? "Criar conta" : "Recuperar senha";
  const sub =
    modo === "entrar"
      ? "Acesse com sua conta pra ver suas missões e se organizar."
      : modo === "cadastrar"
        ? "Cadastre-se pra receber missões e ter sua área própria."
        : "Enviaremos um link pra você redefinir a senha.";

  return (
    <main className="inner equipe-login">
      <div className="page-header">
        <span className="section-eyebrow">Área de missões · acesso dos sócios</span>
        <h1 className="page-heading">
          {titulo} nas <span className="text-gradient">Missões</span>
        </h1>
        <p className="page-sub">{sub}</p>
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
        {modo !== "recuperar" && (
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
        )}

        {erro && <p className="equipe-erro">{erro}</p>}
        {aviso && <p className="equipe-aviso">{aviso}</p>}

        <button className="btn-save" type="submit" disabled={carregando}>
          {carregando ? "Aguarde…" : titulo}
        </button>

        <div className="equipe-links">
          {modo === "entrar" && (
            <>
              <button type="button" className="equipe-toggle" onClick={() => switchModo("cadastrar")}>
                Não tem conta? Criar conta
              </button>
              <button type="button" className="equipe-toggle" onClick={() => switchModo("recuperar")}>
                Esqueci minha senha
              </button>
            </>
          )}
          {modo !== "entrar" && (
            <button type="button" className="equipe-toggle" onClick={() => switchModo("entrar")}>
              Já tem conta? Entrar
            </button>
          )}
        </div>
      </form>
    </main>
  );

  function switchModo(m: Modo) {
    setModo(m);
    setErro("");
    setAviso("");
  }
}
