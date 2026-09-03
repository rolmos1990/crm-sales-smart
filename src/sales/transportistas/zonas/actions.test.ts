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

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    zonaEntrega: {
      findFirst: (...a: unknown[]) => zonaFindFirstMock(...a),
      findMany: (...a: unknown[]) => zonaFindManyMock(...a),
      create: (...a: unknown[]) => zonaCreateMock(...a),
      update: (...a: unknown[]) => zonaUpdateMock(...a),
      delete: (...a: unknown[]) => zonaDeleteMock(...a),
    },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { crearZonaEntrega, eliminarZonaEntrega } = await import("./actions");

const UBICACION_BASE = { paisId: "pais-1", provinciaEstado: "Lima" };

describe("zonas/actions (022, Historia 1)", () => {
  beforeEach(() => {
    requirePermisoActionMock.mockClear().mockResolvedValue({ ok: true, sesion: sesionMock });
    zonaFindFirstMock.mockReset().mockResolvedValue(null);
    zonaFindManyMock.mockReset().mockResolvedValue([]);
    zonaCreateMock.mockReset().mockResolvedValue({ id: "zona-1", nombre: "Lima Norte" });
    zonaUpdateMock.mockReset().mockResolvedValue({ id: "zona-1", nombre: "Lima Norte" });
    zonaDeleteMock.mockReset();
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
