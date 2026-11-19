import { beforeEach, describe, expect, it, vi } from "vitest";

// 042 — Agregado diario y purga del detalle (FR-039, research D13).

const filasDia: Array<Record<string, unknown>> = [];
const upsert = vi.fn(async (..._a: unknown[]) => ({}));
const purgas: Date[] = [];

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    ejecucionAnalisisContactos: {
      findMany: vi.fn(async ({ distinct }: { distinct?: string[] }) => (distinct ? [{ instanciaId: "inst-1" }] : filasDia)),
    },
    resumenDiarioAnalisisContactos: { upsert: (...a: unknown[]) => upsert(...a) },
    $executeRaw: vi.fn(async (_s: TemplateStringsArray, limite: Date) => {
      purgas.push(limite);
      return 0;
    }),
  },
}));
vi.mock("@/shared/fechas/negocio", () => ({ obtenerZonaNegocio: vi.fn(async () => "America/Lima") }));

const { agregarAtenciones, consolidarYPurgar } = await import("./retencion");

const AHORA = new Date("2026-11-19T15:00:00Z");

beforeEach(() => {
  filasDia.length = 0;
  upsert.mockClear();
  purgas.length = 0;
});

describe("agregarAtenciones", () => {
  it("un reintento es una atención más, pero el contacto exitoso cuenta una vez", () => {
    const r = agregarAtenciones([
      { modo: "IA", estado: "FALLIDA", contactosExitosos: 0, contactosFallidos: 20, tokensEntrada: 900, tokensSalida: 10, tokensCacheados: 0, costoEstimado: 0.001, duracionMs: 3000, esperaColaMs: 100 },
      { modo: "IA", estado: "COMPLETADA", contactosExitosos: 20, contactosFallidos: 0, tokensEntrada: 9000, tokensSalida: 3000, tokensCacheados: 500, costoEstimado: 0.01, duracionMs: 8000, esperaColaMs: 200 },
      { modo: "REGLAS", estado: "COMPLETADA", contactosExitosos: 15, contactosFallidos: 0, tokensEntrada: 0, tokensSalida: 0, tokensCacheados: 0, costoEstimado: null, duracionMs: 50, esperaColaMs: null },
    ]);
    expect(r).toMatchObject({
      atenciones: 3,
      atencionesFallidas: 1,
      contactosEvaluados: 35,
      contactosConIA: 20,
      contactosPorReglas: 15,
      tokensEntrada: 9900,
      tokensCacheados: 500,
      duracionTotalMs: 11050,
    });
    expect(r.costoEstimado).toBeCloseTo(0.011);
  });

  it("las abandonadas cuentan como fallidas", () => {
    expect(agregarAtenciones([{ modo: "IA", estado: "ABANDONADA", contactosExitosos: 0, contactosFallidos: 0, tokensEntrada: 0, tokensSalida: 0, tokensCacheados: 0, costoEstimado: null, duracionMs: null, esperaColaMs: null }]).atencionesFallidas).toBe(1);
  });
});

describe("consolidarYPurgar", () => {
  it("recalcula (upsert) ayer y hoy en la zona del negocio: correrlo dos veces deja lo mismo", async () => {
    filasDia.push({ modo: "REGLAS", estado: "COMPLETADA", contactosExitosos: 3, contactosFallidos: 0, tokensEntrada: 0, tokensSalida: 0, tokensCacheados: 0, costoEstimado: null, duracionMs: 10, esperaColaMs: 5 });
    await consolidarYPurgar(AHORA);
    await consolidarYPurgar(AHORA);
    const dias = upsert.mock.calls.map((c) => (c[0] as { where: { instanciaId_dia: { dia: string } } }).where.instanciaId_dia.dia);
    expect(dias).toEqual(["2026-11-18", "2026-11-19", "2026-11-18", "2026-11-19"]);
    const updates = upsert.mock.calls.map((c) => (c[0] as { update: unknown }).update);
    expect(updates[1]).toEqual(updates[3]);
  });

  it("purga el detalle de más de 90 días", async () => {
    await consolidarYPurgar(AHORA);
    expect(purgas[0].toISOString()).toBe(new Date(AHORA.getTime() - 90 * 86_400_000).toISOString());
  });
});
