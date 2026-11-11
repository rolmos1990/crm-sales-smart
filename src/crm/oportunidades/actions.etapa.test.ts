import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/auth/sesion", () => ({ requireSesion: vi.fn() }));
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("./vista", () => ({ cargarVistaOportunidades: vi.fn() }));

const requirePermisoActionMock = vi.fn();
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const moverMock = vi.fn();
vi.mock("@/crm/pipeline/mover-stage", () => ({
  moverOportunidadAEtapa: (...a: unknown[]) => moverMock(...a),
  registrarEntradaInicialAEtapa: vi.fn(),
}));

const findFirstMock = vi.fn();
const updateMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    oportunidad: {
      findFirst: (...a: unknown[]) => findFirstMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));

const { actualizarOportunidad } = await import("./actions");

describe("actualizarOportunidad — cambio de etapa desde el Inbox (D7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermisoActionMock.mockResolvedValue({
      ok: true,
      sesion: { instanciaId: "inst-1", usuarioId: "user-1" },
    });
    findFirstMock.mockResolvedValue({ id: "op-1", stageId: "stage-A", pipelineId: "pipe-1" });
    updateMock.mockResolvedValue({ id: "op-1", valor: 0 });
    moverMock.mockResolvedValue({ exito: true, historialId: "h-1" });
  });

  it("si cambia la etapa, pasa por el servicio único y no reescribe stageId en el update", async () => {
    const r = await actualizarOportunidad("op-1", { stageId: "stage-B" });

    expect(r.exito).toBe(true);
    expect(moverMock).toHaveBeenCalledWith({
      oportunidadId: "op-1",
      stageId: "stage-B",
      pipelineId: "pipe-1",
      instanciaId: "inst-1",
      origen: { tipo: "USUARIO", usuarioId: "user-1" },
    });
    expect(updateMock.mock.calls[0][0].data).not.toHaveProperty("stageId");
  });

  it("si el servicio rechaza el cambio (p.ej. campos requeridos), no guarda nada", async () => {
    moverMock.mockResolvedValue({ exito: false, error: 'Para avanzar a "X" debes completar: Presupuesto' });

    const r = await actualizarOportunidad("op-1", { stageId: "stage-B", notas: "algo" });

    expect(r).toEqual({ exito: false, error: 'Para avanzar a "X" debes completar: Presupuesto' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("si la etapa no cambia, no llama al servicio de movimiento", async () => {
    await actualizarOportunidad("op-1", { stageId: "stage-A", notas: "solo notas" });

    expect(moverMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalled();
  });
});
