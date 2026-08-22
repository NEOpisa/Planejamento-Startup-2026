/**
 * Um certificado para chamar a turma.
 *
 *     npm run cert
 *
 * Existe por uma regra do navegador: **fora do `localhost`, sem HTTPS não há
 * microfone**. Quem sobe o servidor no notebook e manda o link pelo IP da
 * rede vê a sala, escreve no chat e não fala — sem nenhuma mensagem de erro
 * que explique, porque para o navegador não há erro nenhum: a captura
 * simplesmente não é oferecida.
 *
 * O certificado é assinado por ele mesmo, então cada aparelho vai mostrar um
 * aviso na primeira visita ("conexão não é particular" → avançar). Isso é
 * esperado: o aviso diz que ninguém garante quem é este servidor, e quem
 * garante é você, que acabou de subi-lo. O que importa aqui é o outro lado do
 * HTTPS — o navegador passar a considerar a origem segura e liberar o
 * microfone.
 *
 * Os endereços de rede da máquina entram no certificado (SAN) porque é por
 * eles que os outros aparelhos vão chegar; um certificado só de `localhost`
 * seria recusado no celular antes mesmo do aviso.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";

const PASTA = path.resolve(".cert");
const CHAVE = path.join(PASTA, "chave.pem");
const CERT = path.join(PASTA, "certificado.pem");

/** Os IPs por onde os outros aparelhos chegam — sem loopback nem docker. */
function enderecos() {
  const achados = [];
  for (const [nome, lista] of Object.entries(networkInterfaces())) {
    if (/^(lo|docker|br-|veth|virbr)/.test(nome)) continue;
    for (const i of lista ?? []) {
      if (i.family === "IPv4" && !i.internal) achados.push(i.address);
    }
  }
  return [...new Set(achados)];
}

const ips = enderecos();
if (ips.length === 0) {
  console.error("nenhum endereço de rede encontrado — está sem rede?");
  process.exit(1);
}

mkdirSync(PASTA, { recursive: true });

const san = [
  "DNS:localhost",
  "IP:127.0.0.1",
  ...ips.map((ip) => `IP:${ip}`),
].join(",");

const conf = path.join(PASTA, "openssl.cnf");
writeFileSync(
  conf,
  `[req]
distinguished_name = dn
x509_extensions = v3
prompt = no

[dn]
CN = NVDISC local

[v3]
subjectAltName = ${san}
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
`,
);

execFileSync(
  "openssl",
  [
    "req", "-x509", "-newkey", "rsa:2048", "-sha256",
    "-days", "365", "-nodes",
    "-keyout", CHAVE, "-out", CERT,
    "-config", conf,
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

if (!existsSync(CERT)) {
  console.error("o openssl não gerou o certificado");
  process.exit(1);
}

const porta = process.env.PORT ?? 3000;
console.log(`\ncertificado pronto para: localhost, ${ips.join(", ")}\n`);
console.log("suba assim:\n");
console.log(`  TLS_CERT=.cert/certificado.pem TLS_KEY=.cert/chave.pem npm run dev\n`);
console.log("e chame a turma em:\n");
for (const ip of ips) console.log(`  https://${ip}:${porta}/NVDISC`);
console.log(
  "\nNa primeira visita cada aparelho mostra um aviso de certificado —\n" +
    "avançar é o esperado: quem assina este servidor é você.\n",
);
