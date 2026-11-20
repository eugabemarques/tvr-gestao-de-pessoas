// Copia os arquivos da leitura de documentos (Tesseract) para public/ocr/<versão>/,
// para o sistema servir tudo sozinho, sem baixar nada de sites externos.
// Roda antes do "npm run dev" e do "npm run build" (predev/prebuild).
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(raiz, "node_modules");
const versao = JSON.parse(readFileSync(join(nm, "tesseract.js", "package.json"), "utf8")).version;
const destino = join(raiz, "public", "ocr", versao);
mkdirSync(join(destino, "core"), { recursive: true });

const copiar = (de, para) => {
  if (!existsSync(para)) copyFileSync(de, para);
};
copiar(join(nm, "tesseract.js", "dist", "worker.min.js"), join(destino, "worker.min.js"));
// Só as versões "lstm" (o modo padrão de leitura); o próprio Tesseract escolhe a certa para o navegador.
for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"])
  copiar(join(nm, "tesseract.js-core", f), join(destino, "core", f));
// Português, modelo compacto ("best_int").
copiar(join(nm, "@tesseract.js-data", "por", "4.0.0_best_int", "por.traineddata.gz"), join(destino, "por.traineddata.gz"));
console.log("Leitura de documentos: arquivos em public/ocr/" + versao);
