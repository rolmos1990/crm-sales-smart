import { describe, expect, it } from "vitest";

import { INTENCIONES_COMERCIALES } from "../src/ai/estrategia/tipos";
import { EQUIVALENCIA_INTENCION, nivelDesdeIntencion } from "./041-sembrar-interes-contactos";

// 041 (FR-026) — La siembra del interés desde el perfil 012 tiene una
// equivalencia explícita para cada intención que existe hoy.

describe("siembra de interés", () => {
  it("cada intención comercial del catálogo tiene equivalencia declarada", () => {
    for (const intencion of INTENCIONES_COMERCIALES) {
      expect(intencion in EQUIVALENCIA_INTENCION).toBe(true);
    }
  });

  it("mapea las intenciones claras y deja sin evaluar el resto", () => {
    expect(nivelDesdeIntencion("LISTO_PARA_COMPRAR")).toBe("ALTO");
    expect(nivelDesdeIntencion("CONSULTANDO_PRECIO")).toBe("MEDIO");
    expect(nivelDesdeIntencion("EXPLORANDO")).toBe("BAJO");
    expect(nivelDesdeIntencion("REQUIERE_ATENCION_HUMANA")).toBeNull();
    expect(nivelDesdeIntencion(null)).toBeNull();
    expect(nivelDesdeIntencion("ALGO_NUEVO")).toBeNull();
  });
});
