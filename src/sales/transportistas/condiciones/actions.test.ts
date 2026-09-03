import { describe, expect, it, vi, beforeEach } from "vitest";

const sesionMock = { instanciaId: "instancia-1", usuarioId: "usuario-1", nombre: "Ana", rol: "ADMIN" };
const requirePermisoActionMock = vi.fn().mockResolvedValue({ ok: true, sesion: sesionMock });
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const transportistaFindFirstMock = vi.fn();
const condicionesUpsertMock = vi.fn();
const historialCreateMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    transportista: { findFirst: (...a: unknown[]) => transportistaFindFirstMock(...a) },
    condicionesTransportista: { upsert: (...a: unknown[]) => condicionesUpsertMock(...a) },
    transportistaHistorial: { create: (...a: unknown[]) => historialCreateMock(...a) },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { guardarCondicionesTransportista } = await import("./actions");

const DATOS_BASE = {
  transportistaId: "t1",
  diasEntrega: ["LUN", "MAR"],
  tiempoPreparacionDias: 1,
  permiteEntregaMismoDia: true,
  requiereDireccionCompleta: true,
  permiteArticulosFragiles: true,
  permitePagoContraEntrega: false,
};

describe("guardarCondicionesTransportista (022 Historia 4 — completada)", () => {
  beforeEach(() => {
    requirePermisoActionMock.mockClear().mockResolvedValue({ ok: true, sesion: sesionMock });
    transportistaFindFirstMock.mockReset().mockResolvedValue({ id: "t1", condiciones: null });
    condicionesUpsertMock.mockReset().mockResolvedValue({ id: "cond-1", transportistaId: "t1" });
    historialCreateMock.mockReset();
  });

  it("crea las condiciones cuando el transportista no tenía ninguna (upsert)", async () => {
    const resultado = await guardarCondicionesTransportista(DATOS_BASE);
    expect(resultado.exito).toBe(true);
    expect(condicionesUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transportistaId: "t1" },
        create: expect.objectContaining({ transportistaId: "t1", diasEntrega: ["LUN", "MAR"] }),
        update: expect.objectContaining({ diasEntrega: ["LUN", "MAR"] }),
      }),
    );
    expect(historialCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entidadTipo: "CONDICIONES", accion: "creado" }) }),
    );
  });

  it("registra 'editado' cuando ya existían condiciones previas", async () => {
    transportistaFindFirstMock.mockResolvedValue({ id: "t1", condiciones: { id: "cond-1", diasEntrega: [] } });
    await guardarCondicionesTransportista(DATOS_BASE);
    expect(historialCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accion: "editado" }) }),
    );
  });

  it("rechaza si el transportista no pertenece a la instancia actual", async () => {
    transportistaFindFirstMock.mockResolvedValue(null);
    const resultado = await guardarCondicionesTransportista(DATOS_BASE);
    expect(resultado.exito).toBe(false);
    expect(condicionesUpsertMock).not.toHaveBeenCalled();
  });

  it("rechaza datos inválidos sin tocar la base", async () => {
    const resultado = await guardarCondicionesTransportista({ transportistaId: "" });
    expect(resultado.exito).toBe(false);
    expect(transportistaFindFirstMock).not.toHaveBeenCalled();
  });

  it("normaliza campos opcionales vacíos a null", async () => {
    await guardarCondicionesTransportista({ ...DATOS_BASE, horaLimiteMismoDia: "", observaciones: "" });
    expect(condicionesUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ horaLimiteMismoDia: null, observaciones: null }) }),
    );
  });
});
