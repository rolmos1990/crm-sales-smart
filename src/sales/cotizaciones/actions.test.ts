import { describe, expect, it, vi, beforeEach } from "vitest";

const sesionMock = { instanciaId: "instancia-1", usuarioId: "usuario-1", nombre: "Ana", rol: "ADMIN" };
const requirePermisoActionMock = vi.fn().mockResolvedValue({ ok: true, sesion: sesionMock });
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const productoFindManyMock = vi.fn();
const cotizacionCountMock = vi.fn();
const cotizacionCreateMock = vi.fn();
const cotizacionFindFirstMock = vi.fn();
const cotizacionUpdateMock = vi.fn();
const tarifaFindFirstMock = vi.fn();
const configFindUniqueMock = vi.fn();
const historialCreateMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    producto: { findMany: (...a: unknown[]) => productoFindManyMock(...a) },
    cotizacion: {
      count: (...a: unknown[]) => cotizacionCountMock(...a),
      create: (...a: unknown[]) => cotizacionCreateMock(...a),
      findFirst: (...a: unknown[]) => cotizacionFindFirstMock(...a),
      update: (...a: unknown[]) => cotizacionUpdateMock(...a),
    },
    tarifaTransportistaZona: { findFirst: (...a: unknown[]) => tarifaFindFirstMock(...a) },
    configuracionEmpresa: { findUnique: (...a: unknown[]) => configFindUniqueMock(...a) },
    transportistaHistorial: { create: (...a: unknown[]) => historialCreateMock(...a) },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const publicarMock = vi.fn();
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: (...a: unknown[]) => publicarMock(...a) } }));

const { crearCotizacion, aprobarCotizacion } = await import("./actions");

const LINEAS = [{ cantidad: 1, precioUnitario: 100, descuento: 0 }];

const INPUT_BASE = {
  impuesto: 0,
  contactoId: "contacto-1",
  lineas: LINEAS,
};

describe("cotizaciones/actions — envío por tarifa/costo manual (022, Historia 2)", () => {
  beforeEach(() => {
    requirePermisoActionMock.mockClear().mockResolvedValue({ ok: true, sesion: sesionMock });
    productoFindManyMock.mockReset().mockResolvedValue([]);
    cotizacionCountMock.mockReset().mockResolvedValue(0);
    cotizacionCreateMock.mockReset().mockResolvedValue({
      id: "cotizacion-1", numero: "COT-2026-0001", entrega: { id: "entrega-1" },
    });
    cotizacionFindFirstMock.mockReset();
    cotizacionUpdateMock.mockReset();
    tarifaFindFirstMock.mockReset();
    configFindUniqueMock.mockReset().mockResolvedValue(null);
    historialCreateMock.mockReset();
    publicarMock.mockReset();
  });

  describe("crearCotizacion — envío", () => {
    it("aplica una tarifa configurada: copia costoInterno/precioCliente y usa precioCliente como costoEnvio", async () => {
      tarifaFindFirstMock.mockResolvedValue({
        id: "tarifa-1", costoInterno: 8, precioCliente: 15, vigenteDesde: null, vigenteHasta: null,
      });

      const resultado = await crearCotizacion({
        ...INPUT_BASE,
        entrega: { tarifaTransportistaZonaId: "tarifa-1" },
      });

      expect(resultado.exito).toBe(true);
      expect(cotizacionCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            costoEnvio: 15,
            entrega: expect.objectContaining({
              create: expect.objectContaining({ tarifaTransportistaZonaId: "tarifa-1", costoInternoEnvio: 8 }),
            }),
          }),
        })
      );
    });

    it("rechaza una tarifa inactiva o de otra instancia", async () => {
      tarifaFindFirstMock.mockResolvedValue(null);
      const resultado = await crearCotizacion({ ...INPUT_BASE, entrega: { tarifaTransportistaZonaId: "tarifa-x" } });
      expect(resultado.exito).toBe(false);
      expect(cotizacionCreateMock).not.toHaveBeenCalled();
    });

    it("acepta un costo manual con permiso 'transportistas-costos' (rol ADMIN)", async () => {
      const resultado = await crearCotizacion({ ...INPUT_BASE, entrega: { costoManual: 25 } });
      expect(resultado.exito).toBe(true);
      expect(cotizacionCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            costoEnvio: 25,
            entrega: expect.objectContaining({
              create: expect.objectContaining({ costoManualAutorizadoPorId: "usuario-1" }),
            }),
          }),
        })
      );
      expect(historialCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ entidadTipo: "COSTO_MANUAL" }) })
      );
    });

    it("rechaza el costo manual sin el permiso 'transportistas-costos' (rol sin acceso)", async () => {
      requirePermisoActionMock.mockResolvedValue({ ok: true, sesion: { ...sesionMock, rol: "AGENTE_VENTAS" } });
      const resultado = await crearCotizacion({ ...INPUT_BASE, entrega: { costoManual: 25 } });
      expect(resultado.exito).toBe(false);
      expect(cotizacionCreateMock).not.toHaveBeenCalled();
    });

    it("marca 'por confirmar' (costoEnvioConfirmado:false) sin bloquear el guardado", async () => {
      const resultado = await crearCotizacion({
        ...INPUT_BASE,
        entrega: { costoEnvioConfirmado: false, transportistaId: "transportista-1" },
      });
      expect(resultado.exito).toBe(true);
      expect(cotizacionCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entrega: expect.objectContaining({ create: expect.objectContaining({ costoEnvioConfirmado: false }) }),
          }),
        })
      );
    });

    it("registra TransportistaHistorial cuando la zona fue asignada manualmente", async () => {
      const resultado = await crearCotizacion({
        ...INPUT_BASE,
        entrega: { zonaEntregaId: "zona-1", zonaAsignadaManualmente: true },
      });
      expect(resultado.exito).toBe(true);
      expect(historialCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ entidadTipo: "ZONA_MANUAL" }) })
      );
    });
  });

  describe("aprobarCotizacion — confirmación de costo de envío (FR-040)", () => {
    it("bloquea la conversión si costoEnvioConfirmado=false y la empresa no lo permite", async () => {
      cotizacionFindFirstMock.mockResolvedValue({
        id: "cotizacion-1", numero: "COT-2026-0001", estado: "BORRADOR", lineas: [],
        entrega: { costoEnvioConfirmado: false },
      });
      configFindUniqueMock.mockResolvedValue({ permiteConvertirSinConfirmarCostoEnvio: false });

      const resultado = await aprobarCotizacion("cotizacion-1");
      expect(resultado.exito).toBe(false);
      expect(publicarMock).not.toHaveBeenCalled();
    });

    it("permite la conversión sin confirmar cuando la empresa lo habilita", async () => {
      cotizacionFindFirstMock.mockResolvedValue({
        id: "cotizacion-1", numero: "COT-2026-0001", estado: "BORRADOR", lineas: [],
        entrega: { costoEnvioConfirmado: false }, oportunidadId: null,
      });
      configFindUniqueMock.mockResolvedValue({ permiteConvertirSinConfirmarCostoEnvio: true });

      const resultado = await aprobarCotizacion("cotizacion-1");
      expect(resultado.exito).toBe(true);
    });

    it("no exige confirmación cuando costoEnvioConfirmado es true (default)", async () => {
      cotizacionFindFirstMock.mockResolvedValue({
        id: "cotizacion-1", numero: "COT-2026-0001", estado: "BORRADOR", lineas: [],
        entrega: { costoEnvioConfirmado: true }, oportunidadId: null,
      });

      const resultado = await aprobarCotizacion("cotizacion-1");
      expect(resultado.exito).toBe(true);
      expect(configFindUniqueMock).not.toHaveBeenCalled();
    });
  });
});
