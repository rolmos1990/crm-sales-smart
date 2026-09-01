import { describe, expect, it } from "vitest";
import { detectarContradicciones } from "./contradicciones";

describe("detectarContradicciones (009, FR-007)", () => {
  it("no reporta nada si no hay sistemaPrompt libre", () => {
    expect(detectarContradicciones(null, {})).toEqual([]);
    expect(detectarContradicciones(undefined, {})).toEqual([]);
    expect(detectarContradicciones("   ", {})).toEqual([]);
  });

  it("no reporta nada si el texto libre no tiene relación con las reglas", () => {
    const advertencias = detectarContradicciones(
      "Menciona siempre el nombre de la empresa al despedirte.",
      { comportamientosProhibidos: ["Presionar para comprar"] },
    );
    expect(advertencias).toEqual([]);
  });

  it("detecta cuando el texto libre permite confirmar precio sin verificar (regla obligatoria)", () => {
    const advertencias = detectarContradicciones(
      "Puedes confirmar el precio directamente sin verificar el catálogo actual.",
      {},
    );
    expect(advertencias.length).toBeGreaterThan(0);
    expect(advertencias[0]).toMatch(/precio.*disponibilidad.*entrega|contradice una regla obligatoria/i);
  });

  it("detecta cuando el texto libre contradice un comportamiento prohibido configurado", () => {
    const advertencias = detectarContradicciones(
      "Está bien presionar para comprar si el cliente duda mucho.",
      { comportamientosProhibidos: ["Presionar para comprar"] },
    );
    expect(advertencias.length).toBeGreaterThan(0);
    expect(advertencias[0]).toContain("Presionar para comprar");
  });

  it("no genera falso positivo cuando el comportamiento prohibido se menciona sin patrón de permiso", () => {
    const advertencias = detectarContradicciones(
      "Recuerda que presionar para comprar está prohibido en esta empresa.",
      { comportamientosProhibidos: ["Presionar para comprar"] },
    );
    expect(advertencias).toEqual([]);
  });
});
