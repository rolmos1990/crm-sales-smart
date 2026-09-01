import { describe, expect, it, vi, beforeEach } from "vitest";

const sesionMock = { instanciaId: "instancia-1", usuarioId: "usuario-1", rol: "ADMIN" };

const requireSesionMock = vi.fn().mockResolvedValue(sesionMock);
vi.mock("@/shared/auth/sesion", () => ({
  requireSesion: () => requireSesionMock(),
}));

const verificarAccesoMock = vi.fn().mockReturnValue({ permitido: true });
vi.mock("@/shared/auth/permisos", () => ({
  verificarAcceso: (...a: unknown[]) => verificarAccesoMock(...a),
}));

const metodoUpsertMock = vi.fn();
const zonaFindFirstMock = vi.fn();
const metodoFindFirstMock = vi.fn();
const zonaMetodoUpsertMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    metodoEntregaConfig: {
      upsert: (...a: unknown[]) => metodoUpsertMock(...a),
      findFirst: (...a: unknown[]) => metodoFindFirstMock(...a),
    },
    zonaCobertura: { findFirst: (...a: unknown[]) => zonaFindFirstMock(...a) },
    zonaCoberturaMetodo: { upsert: (...a: unknown[]) => zonaMetodoUpsertMock(...a) },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { guardarMetodoEntregaConfig, guardarZonaCoberturaMetodo } = await import("./actions");

describe("configuracion/entregas/actions — modo de cobertura y excepciones (019, Historia 2)", () => {
  beforeEach(() => {
    requireSesionMock.mockClear().mockResolvedValue(sesionMock);
    verificarAccesoMock.mockClear().mockReturnValue({ permitido: true });
    metodoUpsertMock.mockReset().mockResolvedValue({ id: "metodo-1" });
    zonaFindFirstMock.mockReset().mockResolvedValue({ id: "zona-1" });
    metodoFindFirstMock.mockReset().mockResolvedValue({ id: "metodo-1" });
    zonaMetodoUpsertMock.mockReset().mockResolvedValue({ id: "zm-1" });
  });

  describe("guardarMetodoEntregaConfig", () => {
    it("persiste modoCobertura con default SOLO_ZONAS_EVALUADAS cuando no se envía", async () => {
      await guardarMetodoEntregaConfig({ metodoEntrega: "MENSAJERO_PROPIO", costoBase: 10 });
      expect(metodoUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ modoCobertura: "SOLO_ZONAS_EVALUADAS" }),
        })
      );
    });

    it("persiste modoCobertura explícito TODOS_LADOS_CON_EXCEPCIONES", async () => {
      await guardarMetodoEntregaConfig({
        metodoEntrega: "MENSAJERO_PROPIO",
        costoBase: 10,
        modoCobertura: "TODOS_LADOS_CON_EXCEPCIONES",
      });
      expect(metodoUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ modoCobertura: "TODOS_LADOS_CON_EXCEPCIONES" }),
        })
      );
    });
  });

  describe("guardarZonaCoberturaMetodo", () => {
    const INPUT_BASE = {
      zonaCoberturaId: "zona-1",
      metodoEntregaConfigId: "metodo-1",
    };

    it("rechaza cubierta=true y esExcepcion=true simultáneos (FR-007)", async () => {
      const resultado = await guardarZonaCoberturaMetodo({ ...INPUT_BASE, cubierta: true, esExcepcion: true });
      expect(resultado.exito).toBe(false);
      expect(zonaMetodoUpsertMock).not.toHaveBeenCalled();
    });

    it("acepta esExcepcion=true con cubierta=false", async () => {
      const resultado = await guardarZonaCoberturaMetodo({ ...INPUT_BASE, cubierta: false, esExcepcion: true });
      expect(resultado.exito).toBe(true);
      expect(zonaMetodoUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ esExcepcion: true }),
        })
      );
    });

    it("acepta cubierta=true con esExcepcion=false (default)", async () => {
      const resultado = await guardarZonaCoberturaMetodo({ ...INPUT_BASE, cubierta: true });
      expect(resultado.exito).toBe(true);
      expect(zonaMetodoUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ esExcepcion: false }),
        })
      );
    });
  });
});
