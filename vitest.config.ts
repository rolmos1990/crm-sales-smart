import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests (funciones puras — sin DB, sin browser) — separado a propósito
// de Playwright (tests/e2e/**/*.spec.ts), que sigue siendo el corredor de
// integración/E2E del proyecto. Este solo mira *.test.ts.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
