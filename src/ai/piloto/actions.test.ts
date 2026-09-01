import { describe, expect, it, vi, beforeEach } from "vitest";

const sesionMock = { instanciaId: "instancia-1", usuarioId: "usuario-1", rol: "ADMIN" };
const requirePermisoActionMock = vi.fn().mockResolvedValue({ ok: true, sesion: sesionMock });
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const conversacionFindFirstMock = vi.fn();
const pilotoCreateMock = vi.fn();
const pilotoFindFirstMock = vi.fn();
const pilotoUpdateMock = vi.fn();
const recomendacionFindFirstMock = vi.fn();
const recomendacionUpdateMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    conversacion: { findFirst: (...a: unknown[]) => conversacionFindFirstMock(...a), findUnique: vi.fn() },
    conversacionPiloto: {
      create: (...a: unknown[]) => pilotoCreateMock(...a),
      findFirst: (...a: unknown[]) => pilotoFindFirstMock(...a),
      update: (...a: unknown[]) => pilotoUpdateMock(...a),
    },
    recomendacionComportamiento: {
      findFirst: (...a: unknown[]) => recomendacionFindFirstMock(...a),
      update: (...a: unknown[]) => recomendacionUpdateMock(...a),
    },
    playbookEstrategia: { findFirst: vi.fn() },
    ejemploPrompt: { create: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  crearConversacionPiloto,
  incluirEnPerfil,
  aprobarRecomendacion,
  rechazarRecomendacion,
} = await import("./actions");

describe("piloto/actions (014)", () => {
  beforeEach(() => {
    requirePermisoActionMock.mockClear().mockResolvedValue({ ok: true, sesion: sesionMock });
    conversacionFindFirstMock.mockReset().mockResolvedValue({ id: "conv-1" });
    pilotoCreateMock.mockReset().mockResolvedValue({ id: "piloto-1" });
    pilotoFindFirstMock.mockReset();
    pilotoUpdateMock.mockReset();
    recomendacionFindFirstMock.mockReset().mockResolvedValue({ id: "rec-1" });
    recomendacionUpdateMock.mockReset();
  });

  it("crearConversacionPiloto: crea con incluidaEnPerfil false y anonimizadaEn null", async () => {
    const resultado = await crearConversacionPiloto({
      conversacionOrigenId: "conv-1",
      clasificacion: "POSITIVO",
      explicacion: "Buena atención",
    });
    expect(resultado.exito).toBe(true);
    expect(pilotoCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ incluidaEnPerfil: false, anonimizadaEn: null }) }),
    );
  });

  it("incluirEnPerfil: rechaza una conversación piloto sin anonimizadaEn (Edge Case)", async () => {
    pilotoFindFirstMock.mockResolvedValue({ anonimizadaEn: null });
    const resultado = await incluirEnPerfil("piloto-1");
    expect(resultado.exito).toBe(false);
    if (!resultado.exito) expect(resultado.error).toContain("Anonimizá");
    expect(pilotoUpdateMock).not.toHaveBeenCalled();
  });

  it("incluirEnPerfil: acepta una conversación piloto ya anonimizada", async () => {
    pilotoFindFirstMock.mockResolvedValue({ anonimizadaEn: new Date() });
    const resultado = await incluirEnPerfil("piloto-1");
    expect(resultado.exito).toBe(true);
    expect(pilotoUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ data: { incluidaEnPerfil: true } }));
  });

  it("aprobarRecomendacion/rechazarRecomendacion: nunca escriben en AgenteIAConfig/AgenteIAConfigVersion (FR-008)", async () => {
    await aprobarRecomendacion("rec-1");
    await rechazarRecomendacion("rec-1");
    // La única tabla tocada por estas dos acciones es recomendacionComportamiento.
    expect(recomendacionUpdateMock).toHaveBeenCalledTimes(2);
    expect(recomendacionUpdateMock.mock.calls[0][0].data.estado).toBe("APROBADA");
    expect(recomendacionUpdateMock.mock.calls[1][0].data.estado).toBe("RECHAZADA");
  });
});
