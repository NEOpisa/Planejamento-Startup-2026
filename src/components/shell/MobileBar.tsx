"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NAV, FATOS, DESTINOS } from "@/lib/navegacao";
import { MicIcon } from "@/components/icons";
import { comBase } from "@/lib/base.mjs";

/**
 * MOBILE — abaixo de 980px os dois trilhos somem, e o que eles carregam passa
 * a viver aqui: uma barra fixa no topo e, atrás do botão, o menu em tela
 * cheia com os destinos e o estado da sala.
 */
export default function MobileBar() {
  const [aberto, setAberto] = useState(false);
  const path = usePathname();

  // rota mudou → fecha
  useEffect(() => setAberto(false), [path]);

  // menu aberto trava a rolagem do fundo
  useEffect(() => {
    document.body.classList.toggle("menu-aberto", aberto);
    return () => document.body.classList.remove("menu-aberto");
  }, [aberto]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="mbar">
        <Link href={comBase("/")} className="mbar-brand" aria-label="NVDISC — início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" aria-hidden="true" width={34} height={25} />
          <span>
            nvdisc<b>.</b>
          </span>
        </Link>

        <a href="#entrar" className="mbar-cta">
          Entrar
        </a>

        <button
          type="button"
          className="mbar-burger"
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}
        >
          <span className={aberto ? "is-x" : ""} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      </div>

      {aberto && (
        <div className="mmenu" role="dialog" aria-modal="true" aria-label="Menu">
          <nav className="mmenu-nav">
            {NAV.map((r) =>
              r.externo ? (
                <a
                  key={r.href}
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mmenu-item"
                >
                  <span className="mmenu-n">{r.n}</span>
                  {r.label}
                </a>
              ) : (
                <Link
                  key={r.href}
                  href={r.href}
                  className={`mmenu-item${path === r.href ? " is-on" : ""}`}
                >
                  <span className="mmenu-n">{r.n}</span>
                  {r.label}
                </Link>
              ),
            )}
          </nav>

          <a href="#entrar" className="pill mmenu-wa">
            <MicIcon />
            Entrar numa sala
          </a>

          <div className="mmenu-fatos">
            <p className="rstatus">
              <i aria-hidden="true" />
              No ar · sala aberta
            </p>
            <dl className="rfatos">
              {FATOS.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mmenu-uteis">
            {DESTINOS.filter((d) => d.breve).map((d) => (
              <span key={d.titulo} className="rlink is-breve">
                {d.titulo}
                <em>em breve</em>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
