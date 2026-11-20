import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const backend = "http://localhost:5099";
// Versão do Tesseract: os arquivos da leitura ficam em /ocr/<versão>/ (ver scripts/copiar-ocr.mjs).
const ocrVersao = JSON.parse(readFileSync(new URL("./node_modules/tesseract.js/package.json", import.meta.url), "utf8")).version;

export default defineConfig({
  base: "/",
  plugins: [react()],
  define: { __OCR_VERSAO__: JSON.stringify(ocrVersao) },
  server: {
    proxy: {
      "/api": { target: backend, changeOrigin: false },
      "/entrar": { target: backend, changeOrigin: false },
      "/auth": { target: backend, changeOrigin: false },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
