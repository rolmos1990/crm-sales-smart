import { describe, expect, it, vi, beforeEach } from "vitest";

const sesionMock = { instanciaId: "instancia-1", usuarioId: "usuario-1", rol: "ADMIN" };

const requirePermisoActionMock = vi.fn().mockResolvedValue({ ok: true, sesion: sesionMock });
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const obtenerConfiguracionEmpresaMock = vi.fn().mockResolvedValue(null);
vi.mock("@/configuracion/empresa/queries", () => ({
  obtenerConfiguracionEmpresa: (...a: unknown[]) => obtenerConfiguracionEmpresaMock(...a),
}));

const transportistaFindFirstMock = vi.fn();
const estadoProvinciaFindUniqueMock = vi.fn();
const coberturaUpsertMock = vi.fn();
const coberturaFindFirstMock = vi.fn();
const coberturaDeleteMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    transportista: { findFirst: (...a: unknown[]) => transportistaFindFirstMock(...a) },
    estadoProvincia: { findUnique: (...a: unknown[]) => estadoProvinciaFindUniqueMock(...a) },
    transportistaCoberturaGeografica: {
      upsert: (...a: unknown[]) => coberturaUpsertMock(...a),
      findFirst: (...a: unknown[]) => coberturaFindFirstMock(...a),
      delete: (...a: unknown[]) => coberturaDeleteMock(...a),
    },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { guardarCoberturaGeografica, eliminarCoberturaGeografica } = await import("./actions");

const INPUT_BASE = {
  transportistaId: "transportista-1",
  paisId: "pais-pe",
  estadoProvinciaId: "estado-lima",
  costoEnvio: 20,
  activo: true,
};

describe("transportistas/actions — cobertura geográfica (019, Historia 1)", () => {
  beforeEach(() => {
    requirePermisoActionMock.mockClear().mockResolvedValue({ ok: true, sesion: sesionMock });
    obtenerConfiguracionEmpresaMock.mockReset().mockResolvedValue(null);
    transportistaFindFirstMock.mockReset().mockResolvedValue({ id: "transportista-1" });
    estadoProvinciaFindUniqueMock.mockReset().mockResolvedValue({ paisId: "pais-pe" });
    coberturaUpsertMock.mockReset().mockResolvedValue({ id: "cobertura-1", ...INPUT_BASE });
    coberturaFindFirstMock.mockReset();
    coberturaDeleteMock.mockReset();
  });

  describe("guardarCoberturaGeografica", () => {
    it("rechaza costo negativo (FR-016)", async () => {
      const resultado = await guardarCoberturaGeografica({ ...INPUT_BASE, costoEnvio: -5 });
      expect(resultado.exito).toBe(false);
      expect(coberturaUpsertMock).not.toHaveBeenCalled();
    });

    it("rechaza si el transportista no pertenece a la instancia actual", async () => {
      transportistaFindFirstMock.mockResolvedValue(null);
      const resultado = await guardarCoberturaGeografica(INPUT_BASE);
      expect(resultado.exito).toBe(false);
      expect(coberturaUpsertMock).not.toHaveBeenCalled();
    });

    it("rechaza si el estado/provincia no existe", async () => {
      estadoProvinciaFindUniqueMock.mockResolvedValue(null);
      const resultado = await guardarCoberturaGeografica(INPUT_BASE);
      expect(resultado.exito).toBe(false);
      expect(coberturaUpsertMock).not.toHaveBeenCalled();
    });

    it("rechaza si el estado/provincia no pertenece al país indicado (FR-016)", async () => {
      estadoProvinciaFindUniqueMock.mockResolvedValue({ paisId: "pais-otro" });
      const resultado = await guardarCoberturaGeografica(INPUT_BASE);
      expect(resultado.exito).toBe(false);
      expect(coberturaUpsertMock).not.toHaveBeenCalled();
    });

    it("guarda vía upsert por (transportistaId, estadoProvinciaId) — sin duplicar filas", async () => {
      const resultado = await guardarCoberturaGeografica(INPUT_BASE);
      expect(resultado.exito).toBe(true);
      expect(coberturaUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            transportistaId_estadoProvinciaId: {
              transportistaId: "transportista-1",
              estadoProvinciaId: "estado-lima",
            },
          },
        })
      );
    });

    it("en modo UN_SOLO_PAIS, fuerza paisOperacionId en vez del paisId recibido", async () => {
      obtenerConfiguracionEmpresaMock.mockResolvedValue({
        modoGeografico: "UN_SOLO_PAIS",
        paisOperacionId: "pais-operacion",
      });
      estadoProvinciaFindUniqueMock.mockResolvedValue({ paisId: "pais-operacion" });

      const resultado = await guardarCoberturaGeografica({ ...INPUT_BASE, paisId: "pais-distinto-enviado" });

      expect(resultado.exito).toBe(true);
      expect(coberturaUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ paisId: "pais-operacion" }),
        })
      );
    });
  });

  describe("eliminarCoberturaGeografica", () => {
    it("rechaza si la cobertura no pertenece a un transportista de la instancia actual", async () => {
      coberturaFindFirstMock.mockResolvedValue(null);
      const resultado = await eliminarCoberturaGeografica("cobertura-1");
      expect(resultado.exito).toBe(false);
      expect(coberturaDeleteMock).not.toHaveBeenCalled();
    });

    it("elimina cuando la cobertura pertenece a la instancia actual", async () => {
      coberturaFindFirstMock.mockResolvedValue({ id: "cobertura-1" });
      const resultado = await eliminarCoberturaGeografica("cobertura-1");
      expect(resultado.exito).toBe(true);
      expect(coberturaDeleteMock).toHaveBeenCalledWith({ where: { id: "cobertura-1" } });
    });
  });
});
