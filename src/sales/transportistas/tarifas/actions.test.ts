import { describe, expect, it, vi, beforeEach } from "vitest";

const sesionMock = { instanciaId: "instancia-1", usuarioId: "usuario-1", nombre: "Ana", rol: "ADMIN" };
const requirePermisoActionMock = vi.fn().mockResolvedValue({ ok: true, sesion: sesionMock });
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const transportistaFindFirstMock = vi.fn();
const tarifaFindFirstMock = vi.fn();
const tarifaFindManyMock = vi.fn();
const tarifaCreateMock = vi.fn();
const tarifaUpdateMock = vi.fn();
const tarifaDeleteMock = vi.fn();
const tarifaUpdateManyMock = vi.fn();
const tarifaCreateManyMock = vi.fn();
const historialCreateMock = vi.fn();
const entregaCotizacionFindFirstMock = vi.fn();
const entregaPedidoFindFirstMock = vi.fn();
const transactionMock = vi.fn(async (fn: (tx: unknown) => unknown) => fn({
  tarifaTransportistaZona: { updateMany: tarifaUpdateManyMock, createMany: tarifaCreateManyMock },
}));

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    transportista: { findFirst: (...a: unknown[]) => transportistaFindFirstMock(...a) },
    tarifaTransportistaZona: {
      findFirst: (...a: unknown[]) => tarifaFindFirstMock(...a),
      findMany: (...a: unknown[]) => tarifaFindManyMock(...a),
      create: (...a: unknown[]) => tarifaCreateMock(...a),
      update: (...a: unknown[]) => tarifaUpdateMock(...a),
      delete: (...a: unknown[]) => tarifaDeleteMock(...a),
    },
    transportistaHistorial: { create: (...a: unknown[]) => historialCreateMock(...a) },
    entregaCotizacion: { findFirst: (...a: unknown[]) => entregaCotizacionFindFirstMock(...a) },
    entregaPedido: { findFirst: (...a: unknown[]) => entregaPedidoFindFirstMock(...a) },
    $transaction: (fn: (tx: unknown) => unknown) => transactionMock(fn),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { crearTarifa, editarTarifa, duplicarTarifa, toggleTarifa, eliminarTarifa } = await import("./actions");

const INPUT_BASE = {
  transportistaId: "transportista-1",
  zonaEntregaId: "zona-1",
  servicioTransportistaId: "servicio-1",
  costoInterno: 10,
  precioCliente: 15,
};

describe("tarifas/actions (022, Historia 1)", () => {
  beforeEach(() => {
    requirePermisoActionMock.mockClear().mockResolvedValue({ ok: true, sesion: sesionMock });
    transportistaFindFirstMock.mockReset().mockResolvedValue({ id: "transportista-1" });
    tarifaFindFirstMock.mockReset().mockResolvedValue(null);
    tarifaFindManyMock.mockReset().mockResolvedValue([]);
    tarifaCreateMock.mockReset().mockResolvedValue({ id: "tarifa-1", ...INPUT_BASE });
    tarifaUpdateMock.mockReset().mockResolvedValue({ id: "tarifa-1", ...INPUT_BASE });
    tarifaDeleteMock.mockReset();
    tarifaUpdateManyMock.mockReset().mockResolvedValue({ count: 0 });
    tarifaCreateManyMock.mockReset().mockResolvedValue({ count: 0 });
    historialCreateMock.mockReset();
    entregaCotizacionFindFirstMock.mockReset().mockResolvedValue(null);
    entregaPedidoFindFirstMock.mockReset().mockResolvedValue(null);
  });

  describe("crearTarifa", () => {
    it("crea la tarifa y calcula el margen implícitamente (precioCliente - costoInterno)", async () => {
      const resultado = await crearTarifa(INPUT_BASE);
      expect(resultado.exito).toBe(true);
      if (resultado.exito) expect(resultado.advertencia).toBeUndefined();
    });

    it("rechaza costo interno negativo", async () => {
      const resultado = await crearTarifa({ ...INPUT_BASE, costoInterno: -1 });
      expect(resultado.exito).toBe(false);
      expect(tarifaCreateMock).not.toHaveBeenCalled();
    });

    it("rechaza precio al cliente negativo", async () => {
      const resultado = await crearTarifa({ ...INPUT_BASE, precioCliente: -1 });
      expect(resultado.exito).toBe(false);
      expect(tarifaCreateMock).not.toHaveBeenCalled();
    });

    it("advierte sin bloquear cuando precioCliente < costoInterno", async () => {
      const resultado = await crearTarifa({ ...INPUT_BASE, costoInterno: 20, precioCliente: 15 });
      expect(resultado.exito).toBe(true);
      if (resultado.exito) expect(resultado.advertencia).toMatch(/menor/);
      expect(tarifaCreateMock).toHaveBeenCalled();
    });

    it("rechaza tarifa duplicada (mismo transportista+zona+servicio)", async () => {
      tarifaFindFirstMock.mockResolvedValue({ id: "tarifa-existente" });
      const resultado = await crearTarifa(INPUT_BASE);
      expect(resultado.exito).toBe(false);
      expect(tarifaCreateMock).not.toHaveBeenCalled();
    });

    it("rechaza si el transportista no pertenece a la instancia actual", async () => {
      transportistaFindFirstMock.mockResolvedValue(null);
      const resultado = await crearTarifa(INPUT_BASE);
      expect(resultado.exito).toBe(false);
      expect(tarifaCreateMock).not.toHaveBeenCalled();
    });
  });

  describe("editarTarifa", () => {
    it("rechaza si la tarifa no pertenece a la instancia actual", async () => {
      tarifaFindFirstMock.mockResolvedValue(null);
      const resultado = await editarTarifa({ id: "tarifa-1", ...INPUT_BASE });
      expect(resultado.exito).toBe(false);
      expect(tarifaUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe("duplicarTarifa (FR-018)", () => {
    it("crea una copia editable sin afectar la original", async () => {
      tarifaFindFirstMock
        .mockResolvedValueOnce({
          id: "tarifa-1", transportistaId: "transportista-1", zonaEntregaId: "zona-1", servicioTransportistaId: "servicio-1",
          costoInterno: 10, precioCliente: 15, tiempoMinimoDias: 1, tiempoMaximoDias: 2, vigenteDesde: null, vigenteHasta: null,
        })
        .mockResolvedValueOnce(null); // duplicada check: sin conflicto en la zona destino
      const resultado = await duplicarTarifa("tarifa-1", { zonaEntregaId: "zona-2" });
      expect(resultado.exito).toBe(true);
      expect(tarifaCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ zonaEntregaId: "zona-2", activa: false }) })
      );
    });
  });

  describe("eliminarTarifa (FR-020)", () => {
    it("elimina cuando nunca fue usada en cotización o pedido", async () => {
      tarifaFindFirstMock.mockResolvedValue({ id: "tarifa-1" });
      const resultado = await eliminarTarifa("tarifa-1");
      expect(resultado.exito).toBe(true);
      expect(tarifaDeleteMock).toHaveBeenCalledWith({ where: { id: "tarifa-1" } });
    });

    it("solo permite desactivar si ya fue usada en una cotización", async () => {
      tarifaFindFirstMock.mockResolvedValue({ id: "tarifa-1" });
      entregaCotizacionFindFirstMock.mockResolvedValue({ id: "entrega-1" });
      const resultado = await eliminarTarifa("tarifa-1");
      expect(resultado.exito).toBe(false);
      expect(tarifaDeleteMock).not.toHaveBeenCalled();
    });

    it("solo permite desactivar si ya fue usada en un pedido", async () => {
      tarifaFindFirstMock.mockResolvedValue({ id: "tarifa-1" });
      entregaPedidoFindFirstMock.mockResolvedValue({ id: "entrega-1" });
      const resultado = await eliminarTarifa("tarifa-1");
      expect(resultado.exito).toBe(false);
      expect(tarifaDeleteMock).not.toHaveBeenCalled();
    });
  });

  describe("toggleTarifa", () => {
    it("activa/desactiva y registra historial", async () => {
      tarifaFindFirstMock.mockResolvedValue({ activa: true });
      const resultado = await toggleTarifa("tarifa-1");
      expect(resultado.exito).toBe(true);
      expect(historialCreateMock).toHaveBeenCalled();
    });
  });
});
