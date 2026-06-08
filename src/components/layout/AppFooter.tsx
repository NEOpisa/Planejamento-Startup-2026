import Link from "next/link";

export default function AppFooter() {
  return (
    <footer>
      <span className="footer-copy">
        &copy; {new Date().getFullYear()} Neovanguard — Planejamento interno
      </span>
      <div className="footer-links">
        <Link href="/">Roadmap</Link>
        <Link href="/clientes">Clientes & Revisões</Link>
      </div>
    </footer>
  );
}
