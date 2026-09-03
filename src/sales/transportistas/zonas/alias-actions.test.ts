import { describe, expect, it, vi, beforeEach } from "vitest";

const sesionMock = { instanciaId: "instancia-1", usuarioId: "usuario-1", rol: "ADMIN" };
const requirePermisoActionMock = vi.fn().mockResolvedValue({ ok: true, sesion: sesionMock });
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

class PrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}
vi.mock("@/generated/prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError },
}));

const ubicacionFindFirstMock = vi.fn();
const ubicacionFindManyMock = vi.fn();
const aliasFindManyMock = vi.fn();
const aliasFindFirstMock = vi.fn();
const aliasCreateMock = vi.fn();
const aliasDeleteMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    zonaEntregaUbicacion: {
      findFirst: (...a: unknown[]) => ubicacionFindFirstMock(...a),
      findMany: (...a: unknown[]) => ubicacionFindManyMock(...a),
    },
    aliasUbicacion: {
      findMany: (...a: unknown[]) => aliasFindManyMock(...a),
      findFirst: (...a: unknown[]) => aliasFindFirstMock(...a),
      create: (...a: unknown[]) => aliasCreateMock(...a),
      delete: (...a: unknown[]) => aliasDeleteMock(...a),
    },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { listarAliasUbicacion, agregarAliasUbicacion, eliminarAliasUbicacion, listarUbicacionesConAlias } = await import("./alias-actions");

const UBICACION_DAVID = { provinciaEstado: "Chiriquí", distritoCiudad: "David", corregimiento: null, sectorOCodigoPostal: null };

describe("alias-actions (024, Historia 2)", () => {
  beforeEach(() => {
    requirePermisoActionMock.mockClear().mockResolvedValue({ ok: true, sesion: sesionMock });
    ubicacionFindFirstMock.mockReset().mockResolvedValue(UBICACION_DAVID);
    ubicacionFindManyMock.mockReset().mockResolvedValue([]);
    aliasFindManyMock.mockReset().mockResolvedValue([]);
    aliasFindFirstMock.mockReset().mockResolvedValue(null);
    aliasCreateMock.mockReset().mockResolvedValue({ id: "alias-1", valor: "David Centro" });
    aliasDeleteMock.mockReset();
  });

  describe("agregarAliasUbicacion", () => {
    it("crea un alias infiriendo el nivel más específico cuando no se especifica campo", async () => {
      const resultado = await agregarAliasUbicacion({ zonaEntregaUbicacionId: "u1", valor: "David Centro" });
      expect(resultado.exito).toBe(true);
      expect(aliasCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ campo: "DISTRITO_CIUDAD", valor: "David Centro", valorNormalizado: "david-centro" }),
        }),
      );
    });

    it("usa el campo indicado explícitamente si el nivel está configurado", async () => {
      const resultado = await agregarAliasUbicacion({ zonaEntregaUbicacionId: "u1", campo: "PROVINCIA_ESTADO", valor: "Chiriqui" });
      expect(resultado.exito).toBe(true);
      expect(aliasCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ campo: "PROVINCIA_ESTADO" }) }),
      );
    });

    it("rechaza si el campo indicado corresponde a un nivel vacío del destino", async () => {
      const resultado = await agregarAliasUbicacion({ zonaEntregaUbicacionId: "u1", campo: "CORREGIMIENTO", valor: "Algo" });
      expect(resultado.exito).toBe(false);
      expect(aliasCreateMock).not.toHaveBeenCalled();
    });

    it("rechaza si el destino no existe o no pertenece a la instancia actual", async () => {
      ubicacionFindFirstMock.mockResolvedValue(null);
      const resultado = await agregarAliasUbicacion({ zonaEntregaUbicacionId: "u1", valor: "David Centro" });
      expect(resultado.exito).toBe(false);
      expect(aliasCreateMock).not.toHaveBeenCalled();
    });

    it("rechaza un alias duplicado (mismo texto normalizado) verificado antes de crear (FR-003)", async () => {
      aliasFindFirstMock.mockResolvedValue({ id: "alias-existente" });
      const resultado = await agregarAliasUbicacion({ zonaEntregaUbicacionId: "u1", valor: "david centro" });
      expect(resultado.exito).toBe(false);
      expect(aliasCreateMock).not.toHaveBeenCalled();
    });

    it("captura P2002 como resguardo de carrera si igual llega a intentar crear un duplicado", async () => {
      aliasCreateMock.mockRejectedValue(new PrismaClientKnownRequestError("dup", "P2002"));
      const resultado = await agregarAliasUbicacion({ zonaEntregaUbicacionId: "u1", valor: "David Centro" });
      expect(resultado.exito).toBe(false);
      if (!resultado.exito) expect(resultado.error).toContain("Ya existe un alias");
    });

    it("rechaza datos inválidos sin llegar a consultar la base", async () => {
      const resultado = await agregarAliasUbicacion({ zonaEntregaUbicacionId: "u1", valor: "" });
      expect(resultado.exito).toBe(false);
      expect(ubicacionFindFirstMock).not.toHaveBeenCalled();
    });
  });

  describe("eliminarAliasUbicacion", () => {
    it("elimina un alias existente de la instancia actual", async () => {
      aliasFindFirstMock.mockResolvedValue({ id: "alias-1" });
      const resultado = await eliminarAliasUbicacion("alias-1");
      expect(resultado.exito).toBe(true);
      expect(aliasDeleteMock).toHaveBeenCalledWith({ where: { id: "alias-1" } });
    });

    it("rechaza si el alias no pertenece a la instancia actual", async () => {
      aliasFindFirstMock.mockResolvedValue(null);
      const resultado = await eliminarAliasUbicacion("alias-ajeno");
      expect(resultado.exito).toBe(false);
      expect(aliasDeleteMock).not.toHaveBeenCalled();
    });
  });

  describe("listarAliasUbicacion", () => {
    it("lista los alias de una ubicación, scopeado por instancia", async () => {
      await listarAliasUbicacion("u1");
      expect(aliasFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { zonaEntregaUbicacionId: "u1", instanciaId: "instancia-1" } }),
      );
    });

    it("devuelve lista vacía sin permiso", async () => {
      requirePermisoActionMock.mockResolvedValue({ ok: false, error: "Sin permiso" });
      const resultado = await listarAliasUbicacion("u1");
      expect(resultado).toEqual([]);
    });
  });

  describe("listarUbicacionesConAlias", () => {
    it("lista las ubicaciones de una zona con sus alias incluidos, scopeado por instancia", async () => {
      await listarUbicacionesConAlias("zona-1");
      expect(ubicacionFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { zonaEntregaId: "zona-1", zonaEntrega: { instanciaId: "instancia-1" } },
          include: expect.objectContaining({ aliases: expect.anything() }),
        }),
      );
    });

    it("devuelve lista vacía sin permiso", async () => {
      requirePermisoActionMock.mockResolvedValue({ ok: false, error: "Sin permiso" });
      const resultado = await listarUbicacionesConAlias("zona-1");
      expect(resultado).toEqual([]);
    });
  });
});
