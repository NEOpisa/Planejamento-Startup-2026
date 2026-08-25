"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV } from "@/lib/navegacao";
import { ArrowUpRight, MicIcon } from "@/components/icons";
import { comBase } from "@/lib/base.mjs";

/**
 * TRILHO ESQUERDO — navegação, e só. Uma linha por destino, com a lasca de
 * cor à esquerda: fina em repouso, cheia na rota aberta. É o mesmo trilho do
 * NVGHUB, com os destinos daqui.
 *
 * O que ainda não existe **não entra aqui**. A tela de escolha mostra os
 * destinos por vir, porque ali eles contam o que a casa vai ter; num menu
 * eles seriam só quatro cliques que não levam a lugar nenhum.
 */
export default function RailLeft() {
  const path = usePathname();

  return (
    <aside className="rail rail-left" aria-label="Navegação">
      <Link href={comBase("/")} className="rail-brand" aria-label="NVDISC — início">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" aria-hidden="true" width={44} height={32} />
        <span className="rail-brand-word">
          nvdisc<b>.</b>
        </span>
        <span className="rail-tag">voz · tela · texto</span>
      </Link>

      <nav className="navcard" aria-label="Destinos">
        <span className="rcard-h">Ir para</span>
        {NAV.map((r) =>
          r.externo ? (
            <a
              key={r.href}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`nlink nlink--${r.tone}`}
            >
              <span className="nlink-n">{r.n}</span>
              <span className="nlink-label">{r.label}</span>
              <ArrowUpRight />
            </a>
          ) : (
            <Link
              key={r.href}
              href={r.href}
              className={`nlink nlink--${r.tone}`}
              aria-current={path === r.href ? "page" : undefined}
            >
              <span className="nlink-n">{r.n}</span>
              <span className="nlink-label">{r.label}</span>
              <ArrowUpRight />
            </Link>
          ),
        )}
      </nav>

      <a href="#entrar" className="rail-cta rail-cta--accent">
        <MicIcon />
        Entrar numa sala
      </a>

      <div className="rmeta">
        <span>Nada é gravado</span>
        <span>© {new Date().getFullYear()} Neovanguard</span>
      </div>
    </aside>
  );
}
