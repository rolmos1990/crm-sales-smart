import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/db/prisma", () => ({ prisma: {} }));

import { decidirDisponibilidad } from "./presupuesto";

// 042 — Umbrales de disponibilidad (research D9, FR-043, FR-044, FR-044a). La
// medición del consumo (sumas sobre UsoIA en el día del negocio) se cachea y
// se prueba contra la base; acá, la decisión.

const base = {
  prioridad: "P1" as const,
  presupuestoCosto: null,
  presupuestoTokens: null,
  limiteTokensDiariosCuenta: null,
  consumo: { tokensAnalisis: 0, costoAnalisis: 0, tokensTodasLasTareas: 0 },
  proveedorTieneCostos: true,
  limiteProveedorAlcanzado: false,
  presupuestoGlobalUsd: null,
  costoGlobalHoy: 0,
};

describe("decidirDisponibilidad", () => {
  it("sin presupuesto propio (por defecto) está disponible (Clarifications Q3)", () => {
    expect(decidirDisponibilidad(base)).toEqual({ disponible: true });
  });

  it("presupuesto propio en costo alcanzado → no", () => {
    expect(decidirDisponibilidad({ ...base, presupuestoCosto: 2, consumo: { ...base.consumo, costoAnalisis: 2 } })).toMatchObject({
      disponible: false,
      motivo: "PRESUPUESTO_CUENTA",
    });
  });

  it("sin tarifas del proveedor, el presupuesto se mide en tokens", () => {
    const r = decidirDisponibilidad({ ...base, proveedorTieneCostos: false, presupuestoCosto: 2, presupuestoTokens: 1000, consumo: { ...base.consumo, tokensAnalisis: 1000 } });
    expect(r).toMatchObject({ disponible: false, motivo: "PRESUPUESTO_CUENTA" });
  });

  it("al 80 % del límite diario de la cuenta se pausa el histórico pero sigue lo incremental (FR-044a)", () => {
    const consumo = { ...base.consumo, tokensTodasLasTareas: 8000 };
    expect(decidirDisponibilidad({ ...base, prioridad: "P2", limiteTokensDiariosCuenta: 10_000, consumo })).toMatchObject({ disponible: false, motivo: "LIMITE_CUENTA_HISTORICO" });
    expect(decidirDisponibilidad({ ...base, prioridad: "P1", limiteTokensDiariosCuenta: 10_000, consumo })).toEqual({ disponible: true });
    expect(decidirDisponibilidad({ ...base, prioridad: "P0", limiteTokensDiariosCuenta: 10_000, consumo })).toEqual({ disponible: true });
  });

  it("al 100 % del límite diario no se analiza nada con IA", () => {
    const consumo = { ...base.consumo, tokensTodasLasTareas: 10_000 };
    expect(decidirDisponibilidad({ ...base, prioridad: "P0", limiteTokensDiariosCuenta: 10_000, consumo })).toMatchObject({ disponible: false, motivo: "LIMITE_CUENTA" });
  });

  it("límite por minuto o por día del proveedor alcanzado → no", () => {
    expect(decidirDisponibilidad({ ...base, limiteProveedorAlcanzado: true })).toMatchObject({ disponible: false, motivo: "LIMITE_PROVEEDOR" });
  });

  it("el presupuesto global de Karia corta a todas las cuentas", () => {
    expect(decidirDisponibilidad({ ...base, presupuestoGlobalUsd: 50, costoGlobalHoy: 50 })).toMatchObject({ disponible: false, motivo: "PRESUPUESTO_GLOBAL" });
    expect(decidirDisponibilidad({ ...base, presupuestoGlobalUsd: 50, costoGlobalHoy: 49.99 })).toEqual({ disponible: true });
  });
});
