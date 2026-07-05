import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [{ source: "/calculadora", destination: "/calculadora.html", permanent: false }];
  },
};

export default nextConfig;
