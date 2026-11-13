import { describe, expect, it } from "vitest";
import { debeLimpiarEstadoProvincia } from "./debe-limpiar-estado-provincia";

const caso = (paisAnterior: string | null, paisActual: string | null, estadoProvinciaActual: string | null = "ep-chiriqui") =>
  debeLimpiarEstadoProvincia({ paisAnterior, paisActual, estadoProvinciaActual });

describe("debeLimpiarEstadoProvincia", () => {
  it("al abrir una cotización en UN_SOLO_PAIS, resolver el país NO borra la provincia", () => {
    // Primer render: el modo geográfico todavía no llegó, el país vale null.
    // Después llega el país de operación de la instancia.
    expect(caso(null, "pais-pa")).toBe(false);
  });

  it("cambiar de un país a otro sí la borra — ya no pertenece", () => {
    expect(caso("pais-pa", "pais-pe")).toBe(true);
  });

  it("vaciar el país la borra", () => {
    expect(caso("pais-pa", null)).toBe(true);
  });

  it("el mismo país no la toca", () => {
    expect(caso("pais-pa", "pais-pa")).toBe(false);
  });

  it("sin provincia elegida no hay nada que limpiar", () => {
    expect(caso("pais-pa", "pais-pe", null)).toBe(false);
    expect(caso(null, "pais-pa", null)).toBe(false);
  });

  it("país nulo en los dos renders no dispara nada", () => {
    expect(caso(null, null)).toBe(false);
  });
});
