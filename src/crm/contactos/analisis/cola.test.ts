import { beforeEach, describe, expect, it, vi } from "vitest";

// 042 — La semántica fina de la cola (versión monótona, prioridad que no baja,
// SKIP LOCKED) vive en SQL y se prueba contra PostgreSQL con el simulador
// (scripts/042-simular-carga-analisis.ts). Acá se prueba lo que decide
// TypeScript: backoff, caché de parámetros y los valores que llegan al SQL.

const executeRaw = vi.fn(async (..._a: unknown[]) => 1);
const findUnique = vi.fn();
const createMany = vi.fn(async () => ({ count: 1 }));

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    $executeRaw: (...a: unknown[]) => executeRaw(...a),
    configuracionAnalisisContactos: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      createMany: (...a: unknown[]) => createMany(...(a as [])),
    },
  },
}));

const { calcularBackoffMs, marcarPendiente, marcarPendienteSinFallar, invalidarParametrosCola, devolverConBackoff, MAX_INTENTOS } =
  await import("./cola");

/** Valores interpolados en la plantilla SQL de la última llamada a $executeRaw. */
function valoresUltimoSql(): unknown[] {
  const llamada = executeRaw.mock.calls.at(-1)!;
  return llamada.slice(1);
}

beforeEach(() => {
  executeRaw.mockClear();
  findUnique.mockReset();
  createMany.mockClear();
  invalidarParametrosCola("inst-1");
});

describe("calcularBackoffMs", () => {
  it("crece exponencialmente desde 30 s", () => {
    expect(calcularBackoffMs(0, 0.5)).toBe(30_000);
    expect(calcularBackoffMs(1, 0.5)).toBe(60_000);
    expect(calcularBackoffMs(3, 0.5)).toBe(240_000);
  });
  it("tiene tope de 30 min", () => {
    expect(calcularBackoffMs(20, 0.5)).toBe(1_800_000);
  });
  it("el jitter queda entre 0,8 y 1,2", () => {
    expect(calcularBackoffMs(1, 0)).toBe(48_000);
    expect(calcularBackoffMs(1, 1)).toBe(72_000);
  });
  it("al quinto intento el contacto pasa a FALLIDO", () => {
    expect(MAX_INTENTOS).toBe(5);
  });
});

describe("parámetros de la cuenta", () => {
  it("se leen una vez y se cachean: no hay una consulta de configuración por mensaje", async () => {
    findUnique.mockResolvedValue({ ventanaAgrupacionSeg: 300, esperaMaximaSeg: 1800 });
    for (let i = 0; i < 10; i++) {
      await marcarPendiente({ instanciaId: "inst-1", contactoId: "c-1", prioridad: "P1", motivo: "MENSAJE" });
    }
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(10);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("si la cuenta no tiene configuración la crea una sola vez, sin upsert", async () => {
    findUnique.mockResolvedValue(null);
    await marcarPendiente({ instanciaId: "inst-1", contactoId: "c-1", prioridad: "P1", motivo: "MENSAJE" });
    await marcarPendiente({ instanciaId: "inst-1", contactoId: "c-2", prioridad: "P1", motivo: "MENSAJE" });
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith({ data: [{ instanciaId: "inst-1" }], skipDuplicates: true });
  });
});

describe("marcarPendiente", () => {
  beforeEach(() => findUnique.mockResolvedValue({ ventanaAgrupacionSeg: 300, esperaMaximaSeg: 1800 }));

  it("filtra por contacto e instancia y usa la ventana de la cuenta", async () => {
    await marcarPendiente({ instanciaId: "inst-1", contactoId: "c-1", prioridad: "P1", motivo: "PEDIDO" });
    const v = valoresUltimoSql();
    expect(v).toContain("c-1");
    expect(v).toContain("inst-1");
    expect(v).toContain(300);
    expect(v).toContain("INCREMENTAL");
  });

  it("inmediato salta la ventana y la espera máxima", async () => {
    await marcarPendiente({ instanciaId: "inst-1", contactoId: "c-1", prioridad: "P0", motivo: "MANUAL", inmediato: true });
    const v = valoresUltimoSql();
    expect(v).not.toContain(300);
    expect(v).not.toContain(1800);
    expect(v.filter((x) => x === 0).length).toBeGreaterThanOrEqual(2);
  });

  it("solo un pedido explícito reabre un FALLIDO", async () => {
    await marcarPendiente({ instanciaId: "inst-1", contactoId: "c-1", prioridad: "P1", motivo: "MENSAJE" });
    expect(valoresUltimoSql()).not.toContain(true);
    await marcarPendiente({ instanciaId: "inst-1", contactoId: "c-1", prioridad: "P0", motivo: "MANUAL", inmediato: true });
    expect(valoresUltimoSql()).toContain(true);
  });

  it("P2 sin tipo explícito es clasificación INICIAL", async () => {
    await marcarPendiente({ instanciaId: "inst-1", contactoId: "c-1", prioridad: "P2", motivo: "INICIAL" });
    expect(valoresUltimoSql()).toContain("INICIAL");
  });

  it("la variante sin fallar nunca lanza", async () => {
    executeRaw.mockRejectedValueOnce(new Error("conexión caída"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      marcarPendienteSinFallar({ instanciaId: "inst-1", contactoId: "c-1", prioridad: "P1", motivo: "MENSAJE" }),
    ).resolves.toBeUndefined();
    error.mockRestore();
  });
});

describe("devolverConBackoff", () => {
  it("con lista vacía no toca la base", async () => {
    await devolverConBackoff({ instanciaId: "inst-1", contactoIds: [], ejecucionId: null });
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
