import { describe, it, expect } from "vitest";
import { esInaudible, TEXTO_INAUDIBLE } from "./transcribir";

/**
 * La decisión LISTO contra INAUDIBLE es del dominio, no del adaptador: si cada
 * proveedor la tomara a su manera, cambiar de proveedor cambiaría el producto.
 */

function salida(o: Partial<{ texto: string; palabras: number; confianzaIdioma: number | null }> = {}) {
  return {
    texto: "hola, quería consultar el precio",
    palabras: 5,
    confianzaIdioma: 0.98,
    ...o,
  };
}

describe("esInaudible", () => {
  it("texto vacío o solo espacios ⇒ inaudible", () => {
    expect(esInaudible(salida({ texto: "" }))).toBe(true);
    expect(esInaudible(salida({ texto: "   \n  " }))).toBe(true);
  });

  it("cero palabras de habla ⇒ inaudible, aunque el texto no esté vacío", () => {
    // El caso real: un audio de música devuelve una descripción del evento
    // sonoro. Sin esta regla, el agente lo leería como si el cliente hubiera
    // dicho algo.
    expect(esInaudible(salida({ texto: "(música de fondo)", palabras: 0 }))).toBe(true);
  });

  it("confianza de idioma por debajo del umbral ⇒ inaudible", () => {
    expect(esInaudible(salida({ confianzaIdioma: 0.49 }))).toBe(true);
    expect(esInaudible(salida({ confianzaIdioma: 0.5 }))).toBe(false);
  });

  it("sin dato de confianza no se asume lo peor", () => {
    expect(esInaudible(salida({ confianzaIdioma: null }))).toBe(false);
  });

  it("habla reconocible ⇒ NO inaudible", () => {
    expect(esInaudible(salida())).toBe(false);
  });

  it("el literal guardado es exactamente 'Inaudible'", () => {
    // Lo ve el agente en el inbox; cambiarlo cambia la UI (FR-017).
    expect(TEXTO_INAUDIBLE).toBe("Inaudible");
  });
});
