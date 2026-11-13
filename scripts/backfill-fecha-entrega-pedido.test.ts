import { describe, expect, it, vi } from "vitest";
import { ejecutarBackfill } from "./backfill-fecha-entrega-pedido";

function prismaFalso(pedidos: { id: string; numero: string; fechaEstimada: Date | null }[]) {
  const updates: { id: string; fechaEntrega: Date }[] = [];
  const findMany = vi.fn().mockResolvedValue(
    pedidos.map((p) => ({ id: p.id, numero: p.numero, entrega: { fechaEstimada: p.fechaEstimada } })),
  );
  return {
    updates,
    findMany,
    prisma: {
      pedido: {
        findMany,
        update: vi.fn(({ where, data }: { where: { id: string }; data: { fechaEntrega: Date } }) => {
          updates.push({ id: where.id, fechaEntrega: data.fechaEntrega });
          return Promise.resolve({});
        }),
      },
    },
  };
}

const FECHA = new Date("2026-11-13T00:00:00.000Z");

describe("backfill de Pedido.fechaEntrega", () => {
  it("copia la fecha de la entrega al campo que lee el listado", async () => {
    const { prisma, updates } = prismaFalso([{ id: "p1", numero: "PED-0001", fechaEstimada: FECHA }]);

    const r = await ejecutarBackfill(prisma);

    expect(r.actualizados).toBe(1);
    expect(updates).toEqual([{ id: "p1", fechaEntrega: FECHA }]);
  });

  it("solo busca pedidos sin fechaEntrega que SÍ tengan fecha en la entrega", async () => {
    const { prisma, findMany } = prismaFalso([]);

    await ejecutarBackfill(prisma);

    expect(findMany.mock.calls[0][0].where).toEqual({
      fechaEntrega: null,
      entrega: { fechaEstimada: { not: null } },
    });
  });

  it("--dry-run informa pero no escribe", async () => {
    const { prisma, updates } = prismaFalso([{ id: "p1", numero: "PED-0001", fechaEstimada: FECHA }]);

    const r = await ejecutarBackfill(prisma, { dryRun: true });

    expect(r.actualizados).toBe(1);
    expect(updates).toEqual([]);
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it("sin pedidos pendientes no escribe nada — es idempotente", async () => {
    const { prisma, updates } = prismaFalso([]);

    const r = await ejecutarBackfill(prisma);

    expect(r.actualizados).toBe(0);
    expect(updates).toEqual([]);
  });

  it("una entrega sin fecha se salta en vez de escribir null", async () => {
    const { prisma, updates } = prismaFalso([{ id: "p1", numero: "PED-0001", fechaEstimada: null }]);

    const r = await ejecutarBackfill(prisma);

    expect(r.actualizados).toBe(0);
    expect(updates).toEqual([]);
  });
});
