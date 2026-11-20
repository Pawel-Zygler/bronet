import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/static/",
  css: {
    postcss: {
      plugins: [],
    },
  },
  build: {
    outDir: "../static",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
    // Testy komponentów wybierają jsdom komentarzem `// @vitest-environment jsdom`.
    restoreMocks: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});

