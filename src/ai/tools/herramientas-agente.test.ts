import { describe, expect, it } from "vitest";
import { resolverHerramientasAgente } from "./herramientas-agente";
import { HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES } from "./constantes";

// 033 — `buscar_en_documentacion` es condicional, no "siempre disponible".
// El test de cero regresión es el que importa: un agente sin documentación
// tiene que recibir exactamente la misma lista que antes de esta feature.

describe("resolverHerramientasAgente — documentación (033)", () => {
  const base = { herramientas: ["crear_cotizacion"], catalogoEnContexto: true };

  it("NO ofrece la herramienta si el agente no tiene documentación", () => {
    expect(resolverHerramientasAgente({ ...base, tieneDocumentacion: false })).not.toContain(
      "buscar_en_documentacion",
    );
  });

  it("NO la ofrece si el campo ni siquiera viene — cero regresión", () => {
    const sinCampo = resolverHerramientasAgente(base);
    const conFalse = resolverHerramientasAgente({ ...base, tieneDocumentacion: false });

    expect(sinCampo).not.toContain("buscar_en_documentacion");
    // Un llamador que todavía no pasa el campo debe producir la lista idéntica
    // a la de antes de la feature, no una "casi igual".
    expect(sinCampo).toEqual(conFalse);
  });

  it("la ofrece cuando hay documentación indexada", () => {
    expect(resolverHerramientasAgente({ ...base, tieneDocumentacion: true })).toContain(
      "buscar_en_documentacion",
    );
  });

  it("no toca el resto de la resolución", () => {
    const lista = resolverHerramientasAgente({ ...base, tieneDocumentacion: true });

    expect(lista).toContain("crear_cotizacion");
    expect(lista).toContain("buscar_productos");
    for (const operativa of HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES) {
      expect(lista).toContain(operativa);
    }
  });

  it("no duplica si el negocio ya la tenía marcada a mano", () => {
    const lista = resolverHerramientasAgente({
      herramientas: ["buscar_en_documentacion"],
      catalogoEnContexto: true,
      tieneDocumentacion: true,
    });

    expect(lista.filter((h) => h === "buscar_en_documentacion")).toHaveLength(1);
  });
});
