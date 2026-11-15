import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const backend = "http://localhost:5099";

export default defineConfig({
  base: "/",
  plugins: [react()],
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
