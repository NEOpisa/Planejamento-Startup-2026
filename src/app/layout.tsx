import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neovanguard · Planejamento",
  description: "Central de ferramentas internas da Neovanguard — calculadora de precificação e plano de captação.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
