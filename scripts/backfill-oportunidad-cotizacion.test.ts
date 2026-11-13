import { describe, expect, it, vi } from "vitest";
import { ejecutarBackfill } from "./backfill-oportunidad-cotizacion";

function prismaFalso(
  cotizaciones: { id: string; numero: string; contactoId: string }[],
  oportunidadesPorContacto: Record<string, { id: string; titulo: string }[]>,
  pedidosHuerfanos: { id: string; numero: string; cotizacion: { numero: string; oportunidadId: string | null } }[] = [],
) {
  const updates: { id: string; oportunidadId: string }[] = [];
  const pedidoUpdates: unknown[] = [];
  return {
    updates,
    pedidoUpdates,
    prisma: {
      cotizacion: {
        findMany: vi.fn().mockResolvedValue(cotizaciones.map((c) => ({ ...c, instanciaId: "inst-1" }))),
        update: vi.fn(({ where, data }: { where: { id: string }; data: { oportunidadId: string } }) => {
          updates.push({ id: where.id, oportunidadId: data.oportunidadId });
          return Promise.resolve({});
        }),
      },
      oportunidad: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: vi.fn(({ where }: any) =>
          Promise.resolve(oportunidadesPorContacto[where.contactos.some.contactoId] ?? []),
        ),
      },
      pedido: {
        findMany: vi.fn().mockResolvedValue(pedidosHuerfanos),
        updateMany: vi.fn((args: unknown) => {
          pedidoUpdates.push(args);
          return Promise.resolve({ count: 1 });
        }),
      },
    },
  };
}

const COT = { id: "c1", numero: "COT-0001", contactoId: "cont-1" };

describe("backfill del vínculo cotización → oportunidad", () => {
  it("vincula cuando el contacto tiene exactamente una oportunidad", async () => {
    const { prisma, updates } = prismaFalso([COT], { "cont-1": [{ id: "op-1", titulo: "Ana" }] });

    const r = await ejecutarBackfill(prisma);

    expect(r.vinculadas).toBe(1);
    expect(updates).toEqual([{ id: "c1", oportunidadId: "op-1" }]);
  });

  it("propaga el vínculo al pedido que ya se había generado", async () => {
    const { prisma, pedidoUpdates } = prismaFalso([COT], { "cont-1": [{ id: "op-1", titulo: "Ana" }] });

    await ejecutarBackfill(prisma);

    expect(pedidoUpdates[0]).toMatchObject({
      where: { cotizacionId: "c1", oportunidadId: null },
      data: { oportunidadId: "op-1" },
    });
  });

  it("con dos oportunidades no adivina: la deja sin tocar", async () => {
    const { prisma, updates } = prismaFalso([COT], {
      "cont-1": [{ id: "op-1", titulo: "Ana" }, { id: "op-2", titulo: "Ana 2" }],
    });

    const r = await ejecutarBackfill(prisma);

    expect(r.ambiguas).toBe(1);
    expect(r.vinculadas).toBe(0);
    expect(updates).toEqual([]);
  });

  it("un contacto sin oportunidades no genera escritura", async () => {
    const { prisma, updates } = prismaFalso([COT], {});

    const r = await ejecutarBackfill(prisma);

    expect(r.sinOportunidad).toBe(1);
    expect(updates).toEqual([]);
  });

  it("--dry-run informa pero no escribe", async () => {
    const { prisma, updates, pedidoUpdates } = prismaFalso([COT], { "cont-1": [{ id: "op-1", titulo: "Ana" }] });

    const r = await ejecutarBackfill(prisma, { dryRun: true });

    expect(r.vinculadas).toBe(1);
    expect(updates).toEqual([]);
    expect(pedidoUpdates).toEqual([]);
  });

  // Segunda pasada: pedidos generados antes de que
  // generarPedidoDesdeCotizacion copiara el campo. La cotización ya tiene el
  // vínculo; solo falta bajarlo al pedido.
  it("propaga a un pedido huérfano cuya cotización sí tiene oportunidad", async () => {
    const { prisma, pedidoUpdates } = prismaFalso([], {}, [
      { id: "p9", numero: "PED-0009", cotizacion: { numero: "COT-0009", oportunidadId: "op-9" } },
    ]);

    const r = await ejecutarBackfill(prisma);

    expect(r.pedidosVinculados).toBe(1);
    expect(pedidoUpdates).toEqual([
      { where: { id: "p9", oportunidadId: null }, data: { oportunidadId: "op-9" } },
    ]);
  });

  it("--dry-run tampoco escribe en la segunda pasada", async () => {
    const { prisma, pedidoUpdates } = prismaFalso([], {}, [
      { id: "p9", numero: "PED-0009", cotizacion: { numero: "COT-0009", oportunidadId: "op-9" } },
    ]);

    const r = await ejecutarBackfill(prisma, { dryRun: true });

    expect(r.pedidosVinculados).toBe(1);
    expect(pedidoUpdates).toEqual([]);
  });

  it("solo mira pedidos sin oportunidad cuya cotización sí la tiene", async () => {
    const { prisma } = prismaFalso([], {});

    await ejecutarBackfill(prisma);

    expect(prisma.pedido.findMany.mock.calls[0][0].where).toEqual({
      oportunidadId: null,
      cotizacion: { oportunidadId: { not: null } },
    });
  });

  it("solo busca cotizaciones sin oportunidad y con contacto", async () => {
    const { prisma } = prismaFalso([], {});

    await ejecutarBackfill(prisma);

    expect(prisma.cotizacion.findMany.mock.calls[0][0].where).toEqual({
      oportunidadId: null,
      contactoId: { not: null },
    });
  });
});
