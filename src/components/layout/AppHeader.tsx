"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Roadmap", href: "/" },
  { label: "Clientes & Revisões", href: "/clientes" },
];

export default function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="app-header">
      <Link href="/" className="wordmark">
        <span className="wordmark-text">
          N<span className="accent-letters">E</span>OVANGUAR<span className="accent-letters">D</span>
        </span>
      </Link>
      <nav className="nav-desktop">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${pathname === link.href ? "active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
