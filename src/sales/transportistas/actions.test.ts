import { describe, expect, it, vi, beforeEach } from "vitest";

const sesionMock = { instanciaId: "instancia-1", usuarioId: "usuario-1", nombre: "Ana", rol: "ADMIN" };
const requirePermisoActionMock = vi.fn().mockResolvedValue({ ok: true, sesion: sesionMock });
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const transportistaCreateMock = vi.fn();
const transportistaFindFirstMock = vi.fn();
const transportistaFindUniqueMock = vi.fn();
const transportistaUpdateMock = vi.fn();
const historialCreateMock = vi.fn();
const tarifaCountMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    transportista: {
      create: (...a: unknown[]) => transportistaCreateMock(...a),
      findFirst: (...a: unknown[]) => transportistaFindFirstMock(...a),
      findUnique: (...a: unknown[]) => transportistaFindUniqueMock(...a),
      update: (...a: unknown[]) => transportistaUpdateMock(...a),
    },
    transportistaHistorial: { create: (...a: unknown[]) => historialCreateMock(...a) },
    tarifaTransportistaZona: { count: (...a: unknown[]) => tarifaCountMock(...a) },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { crearTransportista, editarTransportista, toggleTransportista } = await import("./actions");

describe("transportistas/actions (022 — corrección de permiso + siembra; 023 — país)", () => {
  beforeEach(() => {
    requirePermisoActionMock.mockClear().mockResolvedValue({ ok: true, sesion: sesionMock });
    transportistaCreateMock.mockReset().mockResolvedValue({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });
    transportistaFindFirstMock.mockReset().mockResolvedValue({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });
    transportistaFindUniqueMock.mockReset().mockResolvedValue({ activo: true });
    transportistaUpdateMock.mockReset().mockResolvedValue({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });
    historialCreateMock.mockReset();
    tarifaCountMock.mockReset().mockResolvedValue(0);
  });

  describe("crearTransportista", () => {
    it("valida contra el módulo 'transportistas' (no 'configuracion')", async () => {
      await crearTransportista({ nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });
      expect(requirePermisoActionMock).toHaveBeenCalledWith("transportistas", "modificar");
    });

    it("siembra 3 servicios (Estándar/Express/Personalizado) y condiciones por defecto", async () => {
      await crearTransportista({ nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });
      expect(transportistaCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            servicios: { create: [{ nombre: "Estándar" }, { nombre: "Express" }, { nombre: "Personalizado" }] },
            condiciones: { create: expect.objectContaining({ permitePagoContraEntrega: false }) },
          }),
        })
      );
    });

    it("registra TransportistaHistorial al crear", async () => {
      await crearTransportista({ nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });
      expect(historialCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ entidadTipo: "TRANSPORTISTA", accion: "creado" }) })
      );
    });

    it("rechaza sin permiso", async () => {
      requirePermisoActionMock.mockResolvedValue({ ok: false, error: "Sin permiso" });
      const resultado = await crearTransportista({ nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });
      expect(resultado.exito).toBe(false);
      expect(transportistaCreateMock).not.toHaveBeenCalled();
    });

    it("rechaza sin país (023 — FR-001)", async () => {
      const resultado = await crearTransportista({ nombre: "DHL", tipo: "COURIER_EXTERNO" });
      expect(resultado.exito).toBe(false);
      expect(transportistaCreateMock).not.toHaveBeenCalled();
    });

    it("persiste el paisId", async () => {
      await crearTransportista({ nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });
      expect(transportistaCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ paisId: "pais-pa" }) })
      );
    });
  });

  describe("editarTransportista", () => {
    it("acepta los campos de contacto nuevos", async () => {
      const resultado = await editarTransportista({
        id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO",
        personaContacto: "Juan Pérez", telefono: "+51999999999", correoElectronico: "juan@dhl.com",
      });
      expect(resultado.exito).toBe(true);
      expect(transportistaUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ personaContacto: "Juan Pérez", correoElectronico: "juan@dhl.com" }) })
      );
    });

    it("rechaza si el transportista no pertenece a la instancia actual", async () => {
      transportistaFindFirstMock.mockResolvedValue(null);
      const resultado = await editarTransportista({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO" });
      expect(resultado.exito).toBe(false);
      expect(transportistaUpdateMock).not.toHaveBeenCalled();
    });

    it("permite fijar el país cuando el transportista todavía no tiene tarifas (país pendiente → asignado)", async () => {
      transportistaFindFirstMock.mockResolvedValue({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: null });
      tarifaCountMock.mockResolvedValue(0);

      const resultado = await editarTransportista({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });

      expect(resultado.exito).toBe(true);
      expect(transportistaUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paisId: "pais-pa" }) }));
    });

    it("rechaza cambiar el país cuando el transportista ya tiene tarifas configuradas (023 — FR-010)", async () => {
      transportistaFindFirstMock.mockResolvedValue({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });
      tarifaCountMock.mockResolvedValue(1);

      const resultado = await editarTransportista({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-co" });

      expect(resultado.exito).toBe(false);
      expect(transportistaUpdateMock).not.toHaveBeenCalled();
    });

    it("no rechaza cuando el país no cambia, aunque tenga tarifas", async () => {
      transportistaFindFirstMock.mockResolvedValue({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });
      tarifaCountMock.mockResolvedValue(3);

      const resultado = await editarTransportista({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });

      expect(resultado.exito).toBe(true);
    });

    it("no consulta tarifas cuando el payload no trae paisId", async () => {
      transportistaFindFirstMock.mockResolvedValue({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });

      const resultado = await editarTransportista({ id: "transportista-1", nombre: "DHL Actualizado", tipo: "COURIER_EXTERNO" });

      expect(resultado.exito).toBe(true);
      expect(tarifaCountMock).not.toHaveBeenCalled();
    });

    it("registra el paisId en el historial", async () => {
      transportistaFindFirstMock.mockResolvedValue({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: null });
      tarifaCountMock.mockResolvedValue(0);

      await editarTransportista({ id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO", paisId: "pais-pa" });

      expect(historialCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valorAnterior: expect.objectContaining({ paisId: null }),
            valorNuevo: expect.objectContaining({ paisId: "pais-pa" }),
          }),
        })
      );
    });
  });

  describe("toggleTransportista", () => {
    it("activa/desactiva y registra historial", async () => {
      const resultado = await toggleTransportista("transportista-1");
      expect(resultado.exito).toBe(true);
      expect(historialCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ accion: "desactivado" }) })
      );
    });

    it("rechaza si el transportista no existe en la instancia", async () => {
      transportistaFindUniqueMock.mockResolvedValue(null);
      const resultado = await toggleTransportista("transportista-1");
      expect(resultado.exito).toBe(false);
    });
  });
});
