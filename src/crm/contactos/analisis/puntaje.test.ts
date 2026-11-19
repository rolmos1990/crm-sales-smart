import { describe, expect, it } from "vitest";

import { acotarAjusteIA, calcularPuntajeBase, combinarPuntaje } from "./puntaje";
import { PLANTILLAS } from "./criterio/plantillas";

const MAX = { compras: 1, recencia: 1, documentosAbiertos: 1, actividadAgendada: 1, esperaRespuesta: 1 };
const MIN = { compras: 0, recencia: 0, documentosAbiertos: 0, actividadAgendada: 0, esperaRespuesta: 0 };

describe("calcularPuntajeBase", () => {
  it.each(Object.entries(PLANTILLAS))("con %s va de 0 a 60", (_c, p) => {
    expect(calcularPuntajeBase(MIN, p.contenido.pesos)).toBe(0);
    expect(calcularPuntajeBase(MAX, p.contenido.pesos)).toBe(60);
  });

  it("factores fuera de [0,1] se acotan", () => {
    const pesos = PLANTILLAS.GENERAL.contenido.pesos;
    expect(calcularPuntajeBase({ ...MAX, compras: 7 }, pesos)).toBe(60);
    expect(calcularPuntajeBase({ ...MIN, recencia: -3 }, pesos)).toBe(0);
  });

  it("pondera según el criterio", () => {
    const solo = { ...MIN, documentosAbiertos: 1 };
    expect(calcularPuntajeBase(solo, PLANTILLAS.B2B.contenido.pesos)).toBeGreaterThan(
      calcularPuntajeBase(solo, PLANTILLAS.RETAIL.contenido.pesos),
    );
  });
});

describe("combinarPuntaje", () => {
  it("sin IA el puntaje es la base", () => expect(combinarPuntaje(34, null)).toBe(34));
  it("suma el ajuste", () => expect(combinarPuntaje(34, 25)).toBe(59));
  it("el ajuste se acota a ±40", () => {
    expect(acotarAjusteIA(90)).toBe(40);
    expect(acotarAjusteIA(-90)).toBe(-40);
    expect(combinarPuntaje(60, 90)).toBe(100);
  });
  it("el final queda en 0–100", () => {
    expect(combinarPuntaje(10, -40)).toBe(0);
    expect(combinarPuntaje(60, 40)).toBe(100);
  });
});
