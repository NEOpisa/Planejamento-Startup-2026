"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV } from "@/lib/navegacao";
import { ArrowUpRight, MicIcon } from "@/components/icons";
import { comBase } from "@/lib/base.mjs";

/**
 * TRILHO ESQUERDO — navegação, e só. Uma linha por ferramenta, com a lasca de
 * cor à esquerda: fina em repouso, cheia na rota aberta. É o mesmo trilho do
 * site público, com os destinos daqui.
 */
export default function RailLeft() {
  const path = usePathname();

  return (
    <aside className="rail rail-left" aria-label="Navegação da central">
      <Link href="/" className="rail-brand" aria-label="NEOVANGUARD — início">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" aria-hidden="true" width={44} height={32} />
        <span className="rail-brand-word">
          neovanguard<b>.</b>
        </span>
        <span className="rail-tag">central de ferramentas</span>
      </Link>

      <nav className="navcard" aria-label="Ferramentas">
        <span className="rcard-h">Ir para</span>
        {NAV.map((r) => (
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
        ))}
      </nav>

      <Link href={comBase("/")} className="rail-cta rail-cta--accent">
        <MicIcon />
        Abrir uma sala
      </Link>

      <div className="rmeta">
        <span>Documento interno</span>
        <span>© {new Date().getFullYear()} Neovanguard</span>
      </div>
    </aside>
  );
}
