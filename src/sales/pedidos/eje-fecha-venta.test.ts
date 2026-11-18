import { describe, expect, it, vi } from "vitest";

import { construirCondicionVenta } from "./condicion-venta";
import { rangoMesHastaHoy } from "@/shared/fechas/rangos";

// 038-cuenta-como-venta — una venta pertenece al período en que SE CONCRETÓ
// (cuándo el pedido llegó a su etapa actual), no a aquel en que se creó el
// pedido. El eje de "Total ventas" es `fechaVenta`, mientras la
// lista y "Total pedidos" siguen sobre `fechaPedido`.
//
// queries.ts importa la instancia de Prisma al cargar el módulo; se dobla
// para poder probar la construcción del `where`, que es lógica pura.
vi.mock("@/shared/db/prisma", () => ({ prisma: {} }));
vi.mock("@/sales/flujo-venta/queries", () => ({ obtenerEtapasFlujoActivo: vi.fn() }));

const { construirWhereVentas } = await import("./queries");

const INSTANCIA = "inst-1";
const ETAPAS = [
  { id: "nuevo", esFinal: false, esCancelacion: false, cuentaComoVenta: false },
  { id: "entregado", esFinal: true, esCancelacion: false, cuentaComoVenta: true },
];
const CONDICION_VENTA = construirCondicionVenta(ETAPAS);

// Noviembre 2026 completo, en la zona de negocio de referencia (Lima, UTC-5).
const NOV_DESDE = new Date("2026-11-01T05:00:00.000Z");
const NOV_HASTA = new Date("2026-12-01T05:00:00.000Z");

describe("construirWhereVentas — eje de fecha", () => {
  it("aplica el rango sobre fechaVenta y NO sobre fechaPedido (FR-017)", () => {
    const where = construirWhereVentas(
      INSTANCIA,
      { desde: NOV_DESDE, hasta: NOV_HASTA },
      CONDICION_VENTA,
    );

    expect(where.fechaVenta).toEqual({ gte: NOV_DESDE, lt: NOV_HASTA });
    // El eje viejo no debe quedar aplicado: si lo estuviera, un pedido creado
    // en octubre y vendido en noviembre quedaría fuera del total de noviembre,
    // que es exactamente el error que 038 corrige.
    expect(where.fechaPedido).toBeUndefined();
  });

  it("usa un rango semiabierto: `lt`, nunca `lte` sobre el límite de día", () => {
    const where = construirWhereVentas(
      INSTANCIA,
      { desde: NOV_DESDE, hasta: NOV_HASTA },
      CONDICION_VENTA,
    );

    expect(where.fechaVenta).not.toHaveProperty("lte");
  });

  it("el rango forzado del mes ignora el filtro de fecha de pantalla (FR-018)", () => {
    const rangoMes = rangoMesHastaHoy("America/Lima", new Date("2026-11-18T15:00:00.000Z"));

    const where = construirWhereVentas(
      INSTANCIA,
      // El usuario tiene octubre filtrado en pantalla...
      { desde: new Date("2026-10-01T05:00:00.000Z"), hasta: new Date("2026-11-01T05:00:00.000Z") },
      CONDICION_VENTA,
      rangoMes,
    );

    // ...y aun así "Total ventas · mes actual" mira noviembre.
    expect(where.fechaVenta).toEqual({ gte: rangoMes.desde, lt: rangoMes.hasta });
  });

  it("resuelve el mes en la zona de negocio, no en la del proceso (FR-019)", () => {
    // 31-oct 23:30 hora de Lima = 1-nov 04:30 UTC. Con la zona de negocio bien
    // aplicada, el mes de octubre debe incluir ese instante; si el rango se
    // calculara en UTC, la venta se escaparía a noviembre.
    const ventaFinDeMes = new Date("2026-11-01T04:30:00.000Z");
    const octubre = rangoMesHastaHoy("America/Lima", new Date("2026-10-31T20:00:00.000Z"));

    expect(ventaFinDeMes.getTime()).toBeGreaterThanOrEqual(octubre.desde.getTime());
    expect(ventaFinDeMes.getTime()).toBeLessThan(octubre.hasta.getTime());
  });
});

describe("construirWhereVentas — composición de filtros", () => {
  it("conserva los filtros no-fecha sin duplicar su construcción", () => {
    const where = construirWhereVentas(
      INSTANCIA,
      { busqueda: "ACME", contactoId: "c-1" },
      CONDICION_VENTA,
    );

    expect(where.instanciaId).toBe(INSTANCIA);
    expect(where.contactoId).toBe("c-1");
    expect(where.OR).toBeDefined();
  });

  it("mantiene la entrega estimada como predicado, no como eje (Decisión 5)", () => {
    const entregaDesde = new Date("2026-11-10T05:00:00.000Z");
    const where = construirWhereVentas(
      INSTANCIA,
      { entregaDesde, desde: NOV_DESDE },
      CONDICION_VENTA,
    );

    expect(where.fechaEntrega).toEqual({ gte: entregaDesde });
    expect(where.fechaVenta).toEqual({ gte: NOV_DESDE });
  });

  // Con spread, `condicionVenta.flujoVentaEtapaId` pisaría al que puso el
  // usuario en la barra y el total mentiría en silencio.
  it("combina por AND para no pisar el filtro de etapa del usuario", () => {
    const where = construirWhereVentas(
      INSTANCIA,
      { flujoVentaEtapaId: "nuevo" },
      CONDICION_VENTA,
    );

    expect(where.flujoVentaEtapaId).toBe("nuevo");
    expect(where.AND).toEqual([{ flujoVentaEtapaId: { in: ["entregado"] } }]);
  });
});

// ── El filtro de la barra ───────────────────────────────────────────────────
// 038 — `desde`/`hasta` dejaron de filtrar `fechaPedido`: ahora el rango de la
// barra ("Hoy", "Última semana", "Últimos 15 días"…) filtra por fecha de
// venta, y la lista comparte eje con las tarjetas de dinero.

const { construirWhere } = await import("./queries");

describe("construirWhere — eje del filtro de la barra", () => {
  it("aplica desde/hasta sobre fechaVenta, no sobre fechaPedido", () => {
    const where = construirWhere(INSTANCIA, { desde: NOV_DESDE, hasta: NOV_HASTA });

    expect(where.fechaVenta).toEqual({ gte: NOV_DESDE, lt: NOV_HASTA });
    expect(where.fechaPedido).toBeUndefined();
  });

  it("usa el mismo eje que construirWhereVentas, para que lista y montos coincidan", () => {
    const filtros = { desde: NOV_DESDE, hasta: NOV_HASTA };

    expect(construirWhere(INSTANCIA, filtros).fechaVenta).toEqual(
      construirWhereVentas(INSTANCIA, filtros, CONDICION_VENTA).fechaVenta,
    );
  });

  it("el filtro de entrega estimada sigue cayendo sobre fechaEntrega", () => {
    const entregaDesde = new Date("2026-11-10T05:00:00.000Z");
    const where = construirWhere(INSTANCIA, { desde: NOV_DESDE, entregaDesde });

    expect(where.fechaEntrega).toEqual({ gte: entregaDesde });
    expect(where.fechaVenta).toEqual({ gte: NOV_DESDE });
  });

  it("sin rango no toca ninguna fecha", () => {
    const where = construirWhere(INSTANCIA, { busqueda: "ACME" });

    expect(where.fechaVenta).toBeUndefined();
    expect(where.fechaPedido).toBeUndefined();
  });
});
