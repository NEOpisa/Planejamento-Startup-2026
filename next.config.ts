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
  /**
   * O caminho da sinalização é o mesmo nas duas casas.
   *
   * Com o `server.mjs`, `/NVDISC/sinal` é atendido pelo próprio processo e
   * nunca chega ao Next. Na Vercel, ele cai aqui e é reescrito para a rota de
   * função que faz o upgrade do WebSocket. O cliente não precisa saber onde
   * está rodando — e, principalmente, não há um segundo endereço para lembrar
   * de configurar em cada ambiente.
   */
  async rewrites() {
    return [{ source: "/NVDISC/sinal", destination: "/api/sinal" }];
  },
  /**
   * A raiz é o NVDISC, e o NVDISC é a única coisa que mora aqui.
   *
   * A ferramenta continua servida de `/NVDISC` porque esse prefixo está no
   * caminho da sinalização, que é lido pelo servidor, pelo cliente e pelo
   * teste. Mudar a raiz para poupar sete caracteres na URL custaria três
   * arquivos e uma classe de defeito que não dá erro — a página carrega
   * bonita e ninguém entra na sala.
   */
  async redirects() {
    return [{ source: "/", destination: "/NVDISC", permanent: false }];
  },
};

export default nextConfig;
