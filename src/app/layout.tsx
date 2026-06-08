import type { Metadata } from "next";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import ScrollProgress from "@/components/ScrollProgress";
import AmbientField from "@/components/AmbientField";
import "./globals.css";

export const metadata: Metadata = {
  title: "Planejamento 2026 — Neovanguard",
  description:
    "Roadmap interno, gestão, governança, clientes e avaliações técnicas da Neovanguard.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Orbitron:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AmbientField />
        <ScrollProgress />
        <AppHeader />
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
