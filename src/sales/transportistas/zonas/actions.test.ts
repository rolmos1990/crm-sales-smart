import { describe, expect, it, vi, beforeEach } from "vitest";

const sesionMock = { instanciaId: "instancia-1", usuarioId: "usuario-1", rol: "ADMIN" };
const requirePermisoActionMock = vi.fn().mockResolvedValue({ ok: true, sesion: sesionMock });
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const zonaFindFirstMock = vi.fn();
const zonaFindManyMock = vi.fn();
const zonaCreateMock = vi.fn();
const zonaUpdateMock = vi.fn();
const zonaDeleteMock = vi.fn();
const ubicacionDeleteManyMock = vi.fn();
const ubicacionUpdateMock = vi.fn();
const ubicacionCreateMock = vi.fn();

const modelos = {
  zonaEntrega: {
    findFirst: (...a: unknown[]) => zonaFindFirstMock(...a),
    findMany: (...a: unknown[]) => zonaFindManyMock(...a),
    create: (...a: unknown[]) => zonaCreateMock(...a),
    update: (...a: unknown[]) => zonaUpdateMock(...a),
    delete: (...a: unknown[]) => zonaDeleteMock(...a),
  },
  zonaEntregaUbicacion: {
    deleteMany: (...a: unknown[]) => ubicacionDeleteManyMock(...a),
    update: (...a: unknown[]) => ubicacionUpdateMock(...a),
    create: (...a: unknown[]) => ubicacionCreateMock(...a),
  },
};

// La transacción corre el callback con los mismos modelos mockeados.
const clientePrisma = { ...modelos, $transaction: (fn: (tx: typeof modelos) => unknown) => fn(modelos) };

vi.mock("@/shared/db/prisma", () => ({ prisma: clientePrisma }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { crearZonaEntrega, editarZonaEntrega, eliminarZonaEntrega } = await import("./actions");

const UBICACION_BASE = { paisId: "pais-1", provinciaEstado: "Lima" };

describe("zonas/actions (022, Historia 1)", () => {
  beforeEach(() => {
    requirePermisoActionMock.mockClear().mockResolvedValue({ ok: true, sesion: sesionMock });
    zonaFindFirstMock.mockReset().mockResolvedValue(null);
    zonaFindManyMock.mockReset().mockResolvedValue([]);
    zonaCreateMock.mockReset().mockResolvedValue({ id: "zona-1", nombre: "Lima Norte" });
    zonaUpdateMock.mockReset().mockResolvedValue({ id: "zona-1", nombre: "Lima Norte" });
    zonaDeleteMock.mockReset();
    ubicacionDeleteManyMock.mockReset();
    ubicacionUpdateMock.mockReset();
    ubicacionCreateMock.mockReset();
  });

  describe("crearZonaEntrega", () => {
    it("crea una zona con varias ubicaciones", async () => {
      const resultado = await crearZonaEntrega({
        nombre: "Lima Norte",
        ubicaciones: [UBICACION_BASE, { paisId: "pais-1", provinciaEstado: "Callao" }],
      });
      expect(resultado.exito).toBe(true);
      expect(zonaCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombre: "Lima Norte",
            ubicaciones: { create: expect.arrayContaining([expect.objectContaining({ provinciaEstado: "Lima" })]) },
          }),
        })
      );
    });

    it("rechaza nombre de zona duplicado en la instancia (case-insensitive)", async () => {
      zonaFindFirstMock.mockResolvedValue({ id: "zona-existente" });
      const resultado = await crearZonaEntrega({ nombre: "lima norte", ubicaciones: [UBICACION_BASE] });
      expect(resultado.exito).toBe(false);
      expect(zonaCreateMock).not.toHaveBeenCalled();
    });

    it("rechaza sin al menos una ubicación", async () => {
      const resultado = await crearZonaEntrega({ nombre: "Lima Norte", ubicaciones: [] });
      expect(resultado.exito).toBe(false);
      expect(zonaCreateMock).not.toHaveBeenCalled();
    });
  });

  describe("editarZonaEntrega", () => {
    /** La zona existe con dos ubicaciones ya guardadas. */
    function zonaConDosUbicaciones() {
      zonaFindFirstMock
        .mockResolvedValueOnce({ id: "zona-1", ubicaciones: [{ id: "ub-1" }, { id: "ub-2" }] })
        // segunda consulta: nombre duplicado
        .mockResolvedValueOnce(null);
    }

    it("actualiza las ubicaciones que siguen estando en vez de recrearlas", async () => {
      zonaConDosUbicaciones();
      const resultado = await editarZonaEntrega({
        id: "zona-1",
        nombre: "Lima Norte",
        ubicaciones: [
          { id: "ub-1", paisId: "pais-1", provinciaEstado: "Lima", distritoCiudad: "Los Olivos" },
          { id: "ub-2", ...UBICACION_BASE },
        ],
      });

      expect(resultado.exito).toBe(true);
      expect(ubicacionUpdateMock).toHaveBeenCalledTimes(2);
      expect(ubicacionCreateMock).not.toHaveBeenCalled();
      expect(ubicacionDeleteManyMock).not.toHaveBeenCalled();
      // nombreVisible/nombreNormalizado se recalculan en el servidor.
      expect(ubicacionUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ub-1" },
          data: expect.objectContaining({ nombreVisible: "Lima > Los Olivos" }),
        }),
      );
    });

    it("solo borra las ubicaciones que el usuario quitó — las demás conservan sus alias", async () => {
      zonaConDosUbicaciones();
      const resultado = await editarZonaEntrega({
        id: "zona-1",
        nombre: "Lima Norte",
        ubicaciones: [{ id: "ub-1", ...UBICACION_BASE }],
      });

      expect(resultado.exito).toBe(true);
      expect(ubicacionDeleteManyMock).toHaveBeenCalledWith({
        where: { id: { in: ["ub-2"] }, zonaEntregaId: "zona-1" },
      });
      expect(ubicacionUpdateMock).toHaveBeenCalledTimes(1);
    });

    it("crea las ubicaciones nuevas (sin id) sin tocar las existentes", async () => {
      zonaConDosUbicaciones();
      await editarZonaEntrega({
        id: "zona-1",
        nombre: "Lima Norte",
        ubicaciones: [
          { id: "ub-1", ...UBICACION_BASE },
          { id: "ub-2", ...UBICACION_BASE },
          { paisId: "pais-1", provinciaEstado: "Callao" },
        ],
      });

      expect(ubicacionUpdateMock).toHaveBeenCalledTimes(2);
      expect(ubicacionCreateMock).toHaveBeenCalledTimes(1);
      expect(ubicacionCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ zonaEntregaId: "zona-1", provinciaEstado: "Callao" }) }),
      );
    });

    it("un id que no pertenece a la zona se crea, nunca se actualiza", async () => {
      zonaConDosUbicaciones();
      await editarZonaEntrega({
        id: "zona-1",
        nombre: "Lima Norte",
        ubicaciones: [{ id: "ub-de-otra-zona", ...UBICACION_BASE }],
      });

      expect(ubicacionUpdateMock).not.toHaveBeenCalled();
      expect(ubicacionCreateMock).toHaveBeenCalledTimes(1);
      expect(ubicacionDeleteManyMock).toHaveBeenCalledWith({
        where: { id: { in: ["ub-1", "ub-2"] }, zonaEntregaId: "zona-1" },
      });
    });

    it("rechaza si otra zona de la instancia ya usa ese nombre", async () => {
      zonaFindFirstMock
        .mockResolvedValueOnce({ id: "zona-1", ubicaciones: [{ id: "ub-1" }] })
        .mockResolvedValueOnce({ id: "zona-2" });

      const resultado = await editarZonaEntrega({
        id: "zona-1",
        nombre: "lima norte",
        ubicaciones: [{ id: "ub-1", ...UBICACION_BASE }],
      });

      expect(resultado.exito).toBe(false);
      expect(zonaUpdateMock).not.toHaveBeenCalled();
    });

    it("rechaza una zona de otra instancia", async () => {
      zonaFindFirstMock.mockResolvedValueOnce(null);
      const resultado = await editarZonaEntrega({
        id: "zona-ajena",
        nombre: "Lima Norte",
        ubicaciones: [{ id: "ub-1", ...UBICACION_BASE }],
      });

      expect(resultado.exito).toBe(false);
      expect(zonaUpdateMock).not.toHaveBeenCalled();
    });

    it("rechaza quedarse sin ubicaciones", async () => {
      const resultado = await editarZonaEntrega({ id: "zona-1", nombre: "Lima Norte", ubicaciones: [] });
      expect(resultado.exito).toBe(false);
      expect(zonaUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe("eliminarZonaEntrega", () => {
    it("rechaza si la zona tiene tarifas configuradas", async () => {
      zonaFindFirstMock.mockResolvedValue({ id: "zona-1", _count: { tarifas: 2 } });
      const resultado = await eliminarZonaEntrega("zona-1");
      expect(resultado.exito).toBe(false);
      expect(zonaDeleteMock).not.toHaveBeenCalled();
    });

    it("elimina cuando ninguna tarifa la referencia", async () => {
      zonaFindFirstMock.mockResolvedValue({ id: "zona-1", _count: { tarifas: 0 } });
      const resultado = await eliminarZonaEntrega("zona-1");
      expect(resultado.exito).toBe(true);
      expect(zonaDeleteMock).toHaveBeenCalledWith({ where: { id: "zona-1" } });
    });
  });
});
