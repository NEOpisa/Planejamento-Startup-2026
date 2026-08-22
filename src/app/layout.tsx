import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";

/**
 * A raiz é só o documento: fontes, tokens e nada mais.
 *
 * A "telinha" de trilhos que o NVGHUB usa vive em `(central)/layout.tsx`, um
 * degrau abaixo — porque o NVDISC precisa da tela inteira. Uma sala de voz com
 * dois trilhos de navegação em volta perderia o vídeo para o menu, e um menu
 * no meio de uma chamada não serve a ninguém.
 */

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-jakarta",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--ff-grotesk",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--ff-mono-var",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#06070b",
};

export const metadata: Metadata = {
  title: "Neovanguard · Central de ferramentas",
  description:
    "Central de ferramentas internas da Neovanguard — calculadora de precificação, plano de captação e sala de voz.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${jakarta.variable} ${grotesk.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
