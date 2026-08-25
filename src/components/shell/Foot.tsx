import Link from "next/link";

import { NAV } from "@/lib/navegacao";

/** A assinatura no pé da coluna de conteúdo — a mesma em toda página. */
export default function Foot() {
  return (
    <footer className="foot">
      <span>© {new Date().getFullYear()} Neovanguard</span>
      <nav aria-label="Rodapé">
        {NAV.map((r) =>
          r.externo ? (
            <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer">
              {r.label}
            </a>
          ) : (
            <Link key={r.href} href={r.href}>
              {r.label}
            </Link>
          ),
        )}
      </nav>
      <span>Nada é gravado</span>
    </footer>
  );
}
