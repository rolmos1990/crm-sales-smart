import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const aggregateMock = vi.fn();
const groupByMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    usoVoz: {
      aggregate: (...a: unknown[]) => aggregateMock(...a),
      groupBy: (...a: unknown[]) => groupByMock(...a),
    },
  },
}));

vi.mock("@/shared/fechas/negocio", () => ({
  obtenerZonaNegocio: () => Promise.resolve("America/Caracas"),
}));

import { obtenerResumenUsoVoz } from "./queries";

type Grupo = {
  proveedorVozId: string | null;
  _sum: { segundos: number | null; costoEstimado: Prisma.Decimal | null };
  _count: { _all: number; costoEstimado: number };
};

function grupo(
  proveedorVozId: string | null,
  segundos: number,
  opciones: { costo?: string; total?: number; conCosto?: number } = {},
): Grupo {
  const total = opciones.total ?? 1;
  return {
    proveedorVozId,
    _sum: {
      segundos,
      costoEstimado: opciones.costo === undefined ? null : new Prisma.Decimal(opciones.costo),
    },
    _count: {
      _all: total,
      costoEstimado: opciones.conCosto ?? (opciones.costo === undefined ? 0 : total),
    },
  };
}

const HOY_VACIO = {
  _sum: { segundos: 0, costoEstimado: null },
  _count: { _all: 0, costoEstimado: 0 },
};

beforeEach(() => {
  aggregateMock.mockReset();
  groupByMock.mockReset();
  aggregateMock.mockResolvedValue(HOY_VACIO);
});

describe("obtenerResumenUsoVoz", () => {
  it("filtra por instancia, solo exitosas y con rango semiabierto", async () => {
    groupByMock.mockResolvedValue([]);

    await obtenerResumenUsoVoz("instancia-1");

    const args = groupByMock.mock.calls[0]![0] as {
      by: string[];
      where: { instanciaId: string; exito: boolean; creadoEn: Record<string, Date> };
      _count: Record<string, boolean>;
    };

    expect(args.by).toEqual(["proveedorVozId"]);
    expect(args.where.instanciaId).toBe("instancia-1");
    expect(args.where.exito).toBe(true);

    // Rango semiabierto [gte, lt). Un `lte` sobre un límite de día pierde las
    // filas escritas en el último milisegundo (regla 7 de CLAUDE.md).
    expect(args.where.creadoEn).toHaveProperty("gte");
    expect(args.where.creadoEn).toHaveProperty("lt");
    expect(args.where.creadoEn).not.toHaveProperty("lte");

    // Los dos contadores: sin el de costoEstimado no se puede distinguir
    // "sin tarifa" de "tarifa cero".
    expect(args._count).toEqual({ _all: true, costoEstimado: true });
  });

  it("deriva el total del mes de los grupos, y las filas lo suman exactamente", async () => {
    groupByMock.mockResolvedValue([
      grupo("prov-a", 5880, { costo: "2.61", total: 40 }),
      grupo("prov-b", 2658, { costo: "1.35", total: 21 }),
      grupo("prov-c", 720, { costo: "0.31", total: 6 }),
    ]);

    const r = await obtenerResumenUsoVoz("instancia-1");

    expect(r.mes.minutos).toBe(Math.round((9258 / 60) * 10) / 10);
    expect(r.mes.transcripciones).toBe(67);

    const sumaMinutos = r.mesPorProveedor.reduce((a, p) => a + p.consumo.minutos, 0);
    expect(Math.round(sumaMinutos * 10) / 10).toBe(r.mes.minutos);

    const sumaCosto = r.mesPorProveedor.reduce((a, p) => a + (p.consumo.costo ?? 0), 0);
    expect(Math.round(sumaCosto * 100) / 100).toBe(Number(r.mes.costo!.toFixed(2)));
  });

  it("las filas suman el total aunque el redondeo por fila no cuadre", async () => {
    // 740 s = 12.333… min cada uno. Redondeando por separado daría 12.3 x3 =
    // 36.9 contra un total de 37.0.
    groupByMock.mockResolvedValue([
      grupo("prov-a", 740),
      grupo("prov-b", 740),
      grupo("prov-c", 740),
    ]);

    const r = await obtenerResumenUsoVoz("instancia-1");

    const sumaMinutos = r.mesPorProveedor.reduce((a, p) => a + p.consumo.minutos, 0);
    expect(Math.round(sumaMinutos * 10) / 10).toBe(r.mes.minutos);
  });

  it("incluye el grupo de proveedores eliminados en el total", async () => {
    groupByMock.mockResolvedValue([
      grupo("prov-a", 5880, { costo: "2.61", total: 40 }),
      grupo(null, 720, { costo: "0.31", total: 6 }),
    ]);

    const r = await obtenerResumenUsoVoz("instancia-1");

    const huerfano = r.mesPorProveedor.find((p) => p.proveedorVozId === null);
    expect(huerfano).toBeDefined();
    expect(r.mes.transcripciones).toBe(46);

    const sumaMinutos = r.mesPorProveedor.reduce((a, p) => a + p.consumo.minutos, 0);
    expect(Math.round(sumaMinutos * 10) / 10).toBe(r.mes.minutos);
  });

  it("marca PARCIAL el grupo con parte del mes sin tarifa", async () => {
    groupByMock.mockResolvedValue([
      grupo("prov-a", 5880, { costo: "2.61", total: 40, conCosto: 25 }),
    ]);

    const r = await obtenerResumenUsoVoz("instancia-1");

    expect(r.mesPorProveedor[0]!.consumo.costoCobertura).toBe("PARCIAL");
    expect(r.mesPorProveedor[0]!.consumo.costo).not.toBeNull();
  });

  it("un grupo sin tarifa da costo null, NUNCA cero", async () => {
    groupByMock.mockResolvedValue([
      grupo("prov-a", 5880, { costo: "2.61", total: 40 }),
      grupo("prov-b", 2658, { total: 21 }),
    ]);

    const r = await obtenerResumenUsoVoz("instancia-1");

    const sinTarifa = r.mesPorProveedor.find((p) => p.proveedorVozId === "prov-b")!;
    expect(sinTarifa.consumo.costo).toBeNull();
    expect(sinTarifa.consumo.costo).not.toBe(0);
    expect(sinTarifa.consumo.costoCobertura).toBe("NO_ESTIMABLE");
    expect(sinTarifa.consumo.minutos).toBeGreaterThan(0);

    // El total sigue sumando solo lo estimable, con el criterio de siempre.
    expect(r.mes.costo).toBe(2.61);
    expect(r.mes.costoCobertura).toBe("PARCIAL");
  });

  it("una cuenta sin consumo da ceros y desglose vacío, sin excepción", async () => {
    groupByMock.mockResolvedValue([]);

    const r = await obtenerResumenUsoVoz("instancia-1");

    expect(r.mes.minutos).toBe(0);
    expect(r.mes.costo).toBeNull();
    expect(r.mes.transcripciones).toBe(0);
    expect(r.mesPorProveedor).toEqual([]);
  });

  it("no desglosa 'hoy' y conserva su cálculo", async () => {
    aggregateMock.mockResolvedValue({
      _sum: { segundos: 486, costoEstimado: new Prisma.Decimal("0.22") },
      _count: { _all: 4, costoEstimado: 4 },
    });
    groupByMock.mockResolvedValue([]);

    const r = await obtenerResumenUsoVoz("instancia-1");

    expect(r.hoy.minutos).toBe(Math.round((486 / 60) * 10) / 10);
    expect(r.hoy.costo).toBe(0.22);
    expect(r.hoy.transcripciones).toBe(4);
  });
});
