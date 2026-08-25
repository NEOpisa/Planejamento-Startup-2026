import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";

/**
 * A raiz é só o documento: fontes, tokens e nada mais.
 *
 * A "telinha" de trilhos do NVGHUB é montada **pela porta** (`NVDISC/page.tsx`)
 * e não aqui, porque a sala precisa da tela inteira. Uma chamada com dois
 * trilhos de navegação em volta perderia o vídeo para o menu, e um menu no
 * meio de uma conversa não serve a ninguém.
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
  title: "NVDISC · sala de voz da Neovanguard",
  description:
    "Voz, tela e texto numa sala, com quadro, notas, fila de fala, enquete e temporizador ao lado. Sem conta e sem cadastro: um nome, um código, e quem digitar o mesmo código cai na mesma sala.",
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
