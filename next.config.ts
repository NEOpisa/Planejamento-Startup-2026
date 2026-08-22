import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  /**
   * Onde o Next guarda o que compila.
   *
   * É `.next` sempre, menos quando alguém pede outro lugar. Quem pede é o
   * teste de navegador: ele sobe um servidor de **desenvolvimento** ao lado do
   * de produção (o defeito que ele cobre só existe em desenvolvimento), e dois
   * modos escrevendo na mesma pasta deixam o de produção sem build — o
   * sintoma é um "Could not find a production build" no meio de um teste que
   * não tem nada a ver com isso.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async redirects() {
    return [{ source: "/calculadora", destination: "/calculadora.html", permanent: false }];
  },
};

export default nextConfig;
