import { beforeEach, describe, expect, it, vi } from "vitest";

// 042 — Recuperación de trabajo abandonado (FR-034, FR-042, SC-012).

const colaUpdateMany = vi.fn(async (..._a: unknown[]) => ({ count: 0 }));
const ejecucionUpdateMany = vi.fn(async (..._a: unknown[]) => ({ count: 0 }));
const executeRaw = vi.fn(async (..._a: unknown[]) => 0);

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    contactoAnalisisCola: { updateMany: (...a: unknown[]) => colaUpdateMany(...a) },
    ejecucionAnalisisContactos: { updateMany: (...a: unknown[]) => ejecucionUpdateMany(...a) },
    $executeRaw: (...a: unknown[]) => executeRaw(...a),
  },
}));

const { recuperarTrabajoAbandonado } = await import("./recuperacion");
const { MAX_INTENTOS } = await import("../cola");

const AHORA = new Date("2026-11-19T15:00:00Z");

beforeEach(() => vi.clearAllMocks());

describe("recuperarTrabajoAbandonado", () => {
  it("un lease vencido vuelve a PENDIENTE sumando un intento", async () => {
    await recuperarTrabajoAbandonado(AHORA);
    const [reencolar] = colaUpdateMany.mock.calls.map((c) => c[0] as { where: Record<string, unknown>; data: Record<string, unknown> });
    expect(reencolar.where).toMatchObject({ estado: "EN_PROCESO", bloqueadoHasta: { lt: AHORA }, intentos: { lt: MAX_INTENTOS - 1 } });
    expect(reencolar.data).toMatchObject({ estado: "PENDIENTE", intentos: { increment: 1 }, versionReclamada: null });
  });

  it("si con ese intento llega al máximo, queda FALLIDO", async () => {
    await recuperarTrabajoAbandonado(AHORA);
    const fallar = colaUpdateMany.mock.calls[1][0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(fallar.where).toMatchObject({ intentos: { gte: MAX_INTENTOS - 1 } });
    expect(fallar.data).toMatchObject({ estado: "FALLIDO" });
  });

  it("una atención EN_CURSO con lease vencido queda ABANDONADA con código INTERRUMPIDA", async () => {
    await recuperarTrabajoAbandonado(AHORA);
    expect(ejecucionUpdateMany).toHaveBeenCalledWith({
      where: { estado: "EN_CURSO", leaseHasta: { lt: AHORA } },
      data: expect.objectContaining({ estado: "ABANDONADA", errorCodigo: "INTERRUMPIDA" }),
    });
  });

  it("si recuperó algo, recalcula lotesEnCurso; si no, no toca la configuración", async () => {
    await recuperarTrabajoAbandonado(AHORA);
    expect(executeRaw).not.toHaveBeenCalled();
    ejecucionUpdateMany.mockResolvedValueOnce({ count: 2 });
    const r = await recuperarTrabajoAbandonado(AHORA);
    expect(r.abandonadas).toBe(2);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});
