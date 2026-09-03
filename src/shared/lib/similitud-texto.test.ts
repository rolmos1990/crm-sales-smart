import { describe, expect, it } from "vitest";
import { distanciaLevenshtein, similitud, UMBRAL_SIMILITUD_APROXIMADA } from "./similitud-texto";

describe("distanciaLevenshtein", () => {
  it("es 0 para textos idénticos", () => {
    expect(distanciaLevenshtein("chorrera", "chorrera")).toBe(0);
  });

  it("cuenta las ediciones mínimas necesarias", () => {
    expect(distanciaLevenshtein("chorrera", "chorera")).toBe(1); // una letra de menos
    expect(distanciaLevenshtein("boquete", "boqete")).toBe(1);
  });

  it("funciona con un lado vacío", () => {
    expect(distanciaLevenshtein("", "abc")).toBe(3);
    expect(distanciaLevenshtein("abc", "")).toBe(3);
  });
});

describe("similitud", () => {
  it("es 1 para textos idénticos", () => {
    expect(similitud("la-chorrera", "la-chorrera")).toBe(1);
  });

  it("es 1 cuando ambos textos están vacíos", () => {
    expect(similitud("", "")).toBe(1);
  });

  it("es alta para un error ortográfico leve", () => {
    const valor = similitud("chorrera", "chorera");
    expect(valor).toBeGreaterThanOrEqual(UMBRAL_SIMILITUD_APROXIMADA);
  });

  it("es baja para textos sin relación", () => {
    const valor = similitud("chorrera", "boquete");
    expect(valor).toBeLessThan(UMBRAL_SIMILITUD_APROXIMADA);
  });
});
