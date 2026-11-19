import { describe, expect, it } from "vitest";

import { percentil, primerosTurnosAntesQueSegundos } from "./042-simular-carga-analisis";

// 042 — Métricas del simulador de carga.

describe("primerosTurnosAntesQueSegundos (SC-007)", () => {
  it("true si todas aparecen antes de la primera repetición", () => {
    expect(primerosTurnosAntesQueSegundos(["a", "b", "c", "a", "b"], 3)).toBe(true);
  });
  it("false si alguna repite antes de que aparezcan todas", () => {
    expect(primerosTurnosAntesQueSegundos(["a", "b", "a", "c"], 3)).toBe(false);
  });
  it("sin repeticiones, alcanza con que estén todas", () => {
    expect(primerosTurnosAntesQueSegundos(["a", "b"], 2)).toBe(true);
    expect(primerosTurnosAntesQueSegundos(["a"], 2)).toBe(false);
  });
});

describe("percentil", () => {
  it("p95 de 1..100 es 95", () => {
    expect(percentil(Array.from({ length: 100 }, (_, i) => i + 1), 95)).toBe(95);
  });
  it("sin datos → null", () => {
    expect(percentil([], 95)).toBeNull();
  });
});
