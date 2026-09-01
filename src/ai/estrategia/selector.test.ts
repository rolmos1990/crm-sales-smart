import { describe, expect, it } from "vitest";
import { seleccionarEstrategia, type EstrategiaAsignada } from "./selector";

function estrategia(overrides: Partial<EstrategiaAsignada> & { playbookEstrategiaId: string }): EstrategiaAsignada {
  return {
    nombre: overrides.playbookEstrategiaId,
    contenido: { reglas: ["regla"] },
    condiciones: { tiposRelacion: [], intenciones: [] },
    prioridadEfectiva: 0,
    asignadaEn: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("seleccionarEstrategia (011, FR-007..009)", () => {
  it("coincidencia simple por tipo de relación selecciona la estrategia correcta con motivo", () => {
    const estrategias = [
      estrategia({ playbookEstrategiaId: "cliente-nuevo", condiciones: { tiposRelacion: ["CLIENTE_NUEVO"], intenciones: [] } }),
    ];
    const resultado = seleccionarEstrategia(estrategias, { tipoRelacion: "CLIENTE_NUEVO" });
    expect(resultado.estrategiaSeleccionada?.playbookEstrategiaId).toBe("cliente-nuevo");
    expect(resultado.motivo).toContain("CLIENTE_NUEVO");
  });

  it("coincidencia por intención selecciona correctamente cuando el tipo de relación no aplica", () => {
    const estrategias = [
      estrategia({
        playbookEstrategiaId: "intencion-alta",
        condiciones: { tiposRelacion: [], intenciones: ["LISTO_PARA_COMPRAR"] },
      }),
    ];
    const resultado = seleccionarEstrategia(estrategias, { intencion: "LISTO_PARA_COMPRAR" });
    expect(resultado.estrategiaSeleccionada?.playbookEstrategiaId).toBe("intencion-alta");
  });

  it("sin coincidencias devuelve null con motivo explicativo", () => {
    const estrategias = [
      estrategia({ playbookEstrategiaId: "a", condiciones: { tiposRelacion: ["CLIENTE_NUEVO"], intenciones: [] } }),
      estrategia({ playbookEstrategiaId: "b", condiciones: { tiposRelacion: ["CLIENTE_INACTIVO"], intenciones: [] } }),
    ];
    const resultado = seleccionarEstrategia(estrategias, { tipoRelacion: "CLIENTE_REGULAR" });
    expect(resultado.estrategiaSeleccionada).toBeNull();
    expect(resultado.motivo).toContain("Sin coincidencias");
    expect(resultado.candidatas).toBe(0);
  });

  it("sin señales (objeto vacío) devuelve null sin fallar cuando las estrategias tienen condiciones", () => {
    const estrategias = [
      estrategia({ playbookEstrategiaId: "a", condiciones: { tiposRelacion: ["CLIENTE_NUEVO"], intenciones: [] } }),
    ];
    expect(() => seleccionarEstrategia(estrategias, {})).not.toThrow();
    expect(seleccionarEstrategia(estrategias, {}).estrategiaSeleccionada).toBeNull();
  });

  it("una estrategia sin ninguna condición aplica siempre que se le asigne, incluso sin señales", () => {
    const estrategias = [estrategia({ playbookEstrategiaId: "generica" })];
    expect(seleccionarEstrategia(estrategias, {}).estrategiaSeleccionada?.playbookEstrategiaId).toBe("generica");
  });

  it("empate de prioridad se resuelve determinísticamente por asignadaEn y se reporta candidatas > 1", () => {
    const estrategias = [
      estrategia({
        playbookEstrategiaId: "vieja",
        condiciones: { tiposRelacion: [], intenciones: ["EXPLORANDO"] },
        prioridadEfectiva: 5,
        asignadaEn: new Date("2026-01-01"),
      }),
      estrategia({
        playbookEstrategiaId: "nueva",
        condiciones: { tiposRelacion: [], intenciones: ["EXPLORANDO"] },
        prioridadEfectiva: 5,
        asignadaEn: new Date("2026-02-01"),
      }),
    ];
    const resultado = seleccionarEstrategia(estrategias, { intencion: "EXPLORANDO" });
    expect(resultado.estrategiaSeleccionada?.playbookEstrategiaId).toBe("nueva");
    expect(resultado.candidatas).toBe(2);
    expect(resultado.motivo).toContain("Empate");
  });

  it("mayor prioridad gana sobre una coincidencia de menor prioridad, sin empate", () => {
    const estrategias = [
      estrategia({
        playbookEstrategiaId: "baja",
        condiciones: { tiposRelacion: [], intenciones: ["EXPLORANDO"] },
        prioridadEfectiva: 1,
      }),
      estrategia({
        playbookEstrategiaId: "alta",
        condiciones: { tiposRelacion: [], intenciones: ["EXPLORANDO"] },
        prioridadEfectiva: 9,
      }),
    ];
    const resultado = seleccionarEstrategia(estrategias, { intencion: "EXPLORANDO" });
    expect(resultado.estrategiaSeleccionada?.playbookEstrategiaId).toBe("alta");
  });
});
