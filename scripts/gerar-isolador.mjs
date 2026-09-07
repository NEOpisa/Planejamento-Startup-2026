/**
 * Costura o isolador de voz num arquivo só, servido de `public/`.
 *
 * Um AudioWorklet não consegue importar nada: `audioWorklet.addModule()`
 * carrega um módulo, mas nenhum navegador implementa `import` lá dentro, e
 * `importScripts` não existe nesse escopo. O código da RNNoise e o do
 * processador precisam, então, chegar já grudados.
 *
 * O `rnnoise-sync.js` do Jitsi serve exatamente para isto: traz o WASM
 * embutido em base64 e sobe sem buscar nada na rede — dentro de um worklet
 * não haveria como buscar. Daqui saem só três emendas: tirar o
 * `import.meta.url`, tirar o `export default` e ligar o nome que o
 * processador espera.
 *
 * Roda no `predev` e no `prebuild`, e o resultado não vai para o git: é
 * derivado de uma dependência, e arquivo derivado versionado é a receita de
 * um dia alguém corrigir o gerador e o bug continuar em produção.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const glue = join(raiz, "node_modules/@jitsi/rnnoise-wasm/dist/rnnoise-sync.js");
const proc = join(raiz, "src/audio/isolador.js");
const saida = join(raiz, "public/isolador-de-voz.js");

let rnnoise = readFileSync(glue, "utf8");

// `import.meta.url` só existe para o emscripten achar o .wasm ao lado — e não
// há .wasm ao lado, ele está embutido. Um caminho vazio é a resposta honesta.
if (!rnnoise.includes("import.meta.url")) {
  throw new Error("rnnoise-sync.js mudou: não achei import.meta.url. Confira o gerador.");
}
rnnoise = rnnoise.replaceAll("import.meta.url", '""');

const exporta = "export default createRNNWasmModuleSync;";
if (!rnnoise.includes(exporta)) {
  throw new Error("rnnoise-sync.js mudou: não achei o export default. Confira o gerador.");
}
rnnoise = rnnoise.replace(exporta, "");

const cabecalho = `// GERADO por scripts/gerar-isolador.mjs — não edite à mão.
// O processador vive em src/audio/isolador.js; a rede neural vem do pacote
// @jitsi/rnnoise-wasm. Rode \`npm run isolador\` depois de mexer em qualquer um.
`;

const cola = `
// O nome que o processador chama. O build síncrono devolve o módulo pronto,
// sem promessa — é o que permite subir a rede dentro do worklet.
const criarRNNoise = () => createRNNWasmModuleSync();
`;

mkdirSync(join(raiz, "public"), { recursive: true });
writeFileSync(saida, cabecalho + rnnoise + cola + readFileSync(proc, "utf8"));

const kb = Math.round(readFileSync(saida).length / 1024);
console.log(`isolador de voz: public/isolador-de-voz.js (${kb} KB)`);
