"use client";

/**
 * NVDISC — a entrada.
 *
 * Dois campos e um botão. Não há conta, não há senha, não há "continuar com":
 * quem tem o código entra, e é essa a ideia toda. O nome fica no navegador
 * (`localStorage`) só para não ser redigitado — ele nunca sai daqui para lugar
 * nenhum a não ser a sala em que você entrar.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { limparNome, limparSala, salaAleatoria, LIMITES } from "@/lib/protocolo.mjs";
import { comBase } from "@/lib/base.mjs";
import "./nvdisc.css";

export default function Entrada() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [sala, setSala] = useState("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setNome(localStorage.getItem("nvdisc:nome") ?? "");
    // O código da URL (`?sala=xyz`) vence o que estiver guardado: é assim que
    // um link compartilhado leva a pessoa para a sala certa.
    const daUrl = new URLSearchParams(location.search).get("sala");
    if (daUrl) setSala(limparSala(daUrl));
    setPronto(true);
  }, []);

  const nomeOk = limparNome(nome).length > 0;
  const salaOk = limparSala(sala).length > 0;

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeOk || !salaOk) return;
    localStorage.setItem("nvdisc:nome", limparNome(nome));
    router.push(comBase(`/sala/${encodeURIComponent(limparSala(sala))}`));
  }

  return (
    <main className="nv nv-fundo nv-entrada">
      <div className="caixa">
        <Link href="/" className="marca" aria-label="NEOVANGUARD — central">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" aria-hidden="true" width={38} height={28} />
          <span className="nm">
            neovanguard<b>.</b>
          </span>
        </Link>

        <span className="eyebrow">Ferramenta · Conversa</span>
        <h1>NVDISC</h1>
        <p className="lede">
          Voz, tela e texto numa sala. Sem conta e sem cadastro — põe um nome,
          escolhe um código e entra.
        </p>

        <form onSubmit={entrar} className="nv-cantos">
          <div className="nv-campo">
            <label className="nv-rotulo" htmlFor="nome">
              Seu nome
            </label>
            <input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={LIMITES.NOME}
              placeholder="como te chamam"
              autoComplete="off"
            />
          </div>

          <div className="nv-campo">
            <label className="nv-rotulo" htmlFor="sala">
              Código da sala
            </label>
            <div className="linha">
              <input
                id="sala"
                value={sala}
                onChange={(e) => setSala(e.target.value)}
                maxLength={LIMITES.SALA}
                placeholder="churrasco"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="nv-btn"
                onClick={() => setSala(salaAleatoria())}
                title="sortear um código"
              >
                sortear
              </button>
            </div>
            <p className="nv-nota">
              Qualquer palavra serve. Quem digitar o mesmo código cai na mesma
              sala — é assim que vocês se encontram.
            </p>
          </div>

          <button
            type="submit"
            className="nv-btn principal"
            disabled={!pronto || !nomeOk || !salaOk}
          >
            Entrar na sala
          </button>
        </form>

        <p className="nv-nota" style={{ marginTop: 22, textAlign: "center" }}>
          A conversa vai <strong style={{ color: "var(--txt-2)" }}>direto</strong> de
          um computador ao outro. O servidor só apresenta vocês — não passa
          áudio, não passa vídeo, e nada fica gravado.
        </p>

        <p style={{ marginTop: 26, textAlign: "center" }}>
          <Link href="/" className="voltar">
            ← Central de ferramentas
          </Link>
        </p>
      </div>
    </main>
  );
}
