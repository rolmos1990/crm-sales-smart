import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests (funciones puras — sin DB, sin browser) — separado a propósito
// de Playwright (tests/e2e/**/*.spec.ts), que sigue siendo el corredor de
// integración/E2E del proyecto. Este solo mira *.test.ts.
export default defineConfig({
  test: {
    // 023-transportistas-por-pais — scripts/*.test.ts se suma para poder
    // testear la lógica pura de scripts/backfill-pais-transportista.ts sin
    // moverlo fuera de scripts/ (research.md Decisión 4).
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
