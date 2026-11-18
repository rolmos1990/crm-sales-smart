import { beforeEach, describe, expect, it, vi } from "vitest";

// 041 (FR-027) — El perfil del cliente cuenta compras con la misma regla de
// venta que los totales de Pedidos y que el indicador "Clientes" de Contactos.
// Se verifica el `where` que recibe Prisma, no un resultado de base.

const pedidoFindMany = vi.fn().mockResolvedValue([]);
const etapasFlujo = vi.fn();

vi.mock("@/sales/flujo-venta/queries", () => ({ obtenerEtapasFlujoActivo: (...a: unknown[]) => etapasFlujo(...a) }));
vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    contacto: { findFirst: vi.fn().mockResolvedValue({ creadoEn: new Date("2026-01-01") }) },
    pedido: { findMany: (...a: unknown[]) => pedidoFindMany(...a) },
    oportunidadContacto: { findMany: vi.fn().mockResolvedValue([]) },
    cotizacion: { findMany: vi.fn().mockResolvedValue([]) },
    conversacion: { count: vi.fn().mockResolvedValue(0) },
    entregaPedido: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const { calcularDatosObjetivos } = await import("./calculo-objetivo");

function wherePedidos() {
  return (pedidoFindMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
}

describe("calcularDatosObjetivos — compras", () => {
  beforeEach(() => vi.clearAllMocks());

  it("con flujo dinámico cuenta solo las etapas marcadas 'Cuenta como Venta'", async () => {
    etapasFlujo.mockResolvedValue([
      { id: "nuevo", esFinal: false, esCancelacion: false, cuentaComoVenta: false },
      { id: "entregado", esFinal: true, esCancelacion: false, cuentaComoVenta: true },
    ]);
    await calcularDatosObjetivos("c-1", "inst-1");
    expect(wherePedidos()).toEqual({ contactoId: "c-1", instanciaId: "inst-1", flujoVentaEtapaId: { in: ["entregado"] } });
  });

  it("con flujo sin ninguna etapa marcada no cuenta ninguna compra (no 'todas')", async () => {
    etapasFlujo.mockResolvedValue([{ id: "nuevo", esFinal: false, esCancelacion: false, cuentaComoVenta: false }]);
    await calcularDatosObjetivos("c-1", "inst-1");
    expect(wherePedidos()).toEqual({ contactoId: "c-1", instanciaId: "inst-1", flujoVentaEtapaId: { in: [] } });
  });

  it("sin flujo dinámico cae al estado clásico ENTREGADO", async () => {
    etapasFlujo.mockResolvedValue([]);
    await calcularDatosObjetivos("c-1", "inst-1");
    expect(wherePedidos()).toEqual({ contactoId: "c-1", instanciaId: "inst-1", estado: "ENTREGADO" });
  });

  it("la última compra usa la fecha de venta cuando existe", async () => {
    etapasFlujo.mockResolvedValue([]);
    pedidoFindMany.mockResolvedValueOnce([
      { fechaVenta: new Date("2026-10-05"), fechaEntrega: new Date("2026-11-01"), creadoEn: new Date("2026-10-01"), lineas: [] },
    ]);
    const datos = await calcularDatosObjetivos("c-1", "inst-1");
    expect(datos.fechaUltimaCompra).toBe(new Date("2026-10-05").toISOString());
  });
});
