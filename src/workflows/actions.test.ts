import { describe, expect, it, vi, beforeEach } from "vitest";
import { definicionInicial } from "./schema";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requirePermisoActionMock = vi.fn();
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const validarParaPublicarMock = vi.fn();
vi.mock("./definicion/validador", () => ({ validarParaPublicar: (...a: unknown[]) => validarParaPublicarMock(...a) }));
vi.mock("./definicion/consultas-referencias", () => ({ crearConsultasReferencias: vi.fn() }));

const workflowFindFirst = vi.fn();
const workflowUpdate = vi.fn();
const versionFindFirst = vi.fn();
const versionCreate = vi.fn();
const stageFindFirst = vi.fn();
const asignacionUpdateMany = vi.fn();
const asignacionCreate = vi.fn();
const transaction = vi.fn();
const tx = {
  workflowVersion: { findFirst: versionFindFirst, create: versionCreate },
  workflow: { update: workflowUpdate },
};
vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    workflow: { findFirst: (...a: unknown[]) => workflowFindFirst(...a), update: (...a: unknown[]) => workflowUpdate(...a) },
    pipelineStage: { findFirst: (...a: unknown[]) => stageFindFirst(...a) },
    workflowAsignacion: {
      updateMany: (...a: unknown[]) => asignacionUpdateMany(...a),
      create: (...a: unknown[]) => asignacionCreate(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

const { publicarWorkflow, asignarWorkflowAEtapa, guardarBorradorWorkflow } = await import("./actions");

const VALIDO = { valido: true, errores: [], advertencias: [] };

describe("acciones de Workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermisoActionMock.mockResolvedValue({ ok: true, sesion: { instanciaId: "inst-1", usuarioId: "u-1" } });
    workflowFindFirst.mockResolvedValue({ id: "wf-1", nombre: "W", borrador: {}, estado: "BORRADOR", versionPublicadaId: null });
    transaction.mockImplementation((arg: unknown) => (typeof arg === "function" ? (arg as (t: typeof tx) => unknown)(tx) : Promise.all(arg as Promise<unknown>[])));
    versionCreate.mockResolvedValue({ id: "ver-3" });
  });

  it("sin permiso no publica", async () => {
    requirePermisoActionMock.mockResolvedValue({ ok: false, error: "Sin permiso" });
    expect(await publicarWorkflow("wf-1", definicionInicial())).toEqual({ exito: false, error: "Sin permiso" });
    expect(transaction).not.toHaveBeenCalled();
    expect(requirePermisoActionMock).toHaveBeenCalledWith("workflows", "modificar");
  });

  it("con errores de validación guarda el borrador pero no crea versión", async () => {
    const invalido = { valido: false, errores: [{ codigo: "SIN_FIN", mensaje: "Falta Fin" }], advertencias: [] };
    validarParaPublicarMock.mockResolvedValue(invalido);

    const r = await publicarWorkflow("wf-1", definicionInicial());

    expect(r).toMatchObject({ exito: false, validacion: invalido });
    expect(versionCreate).not.toHaveBeenCalled();
    expect(workflowUpdate).toHaveBeenCalledTimes(1);
  });

  it("publicar crea la versión siguiente y la deja vigente", async () => {
    validarParaPublicarMock.mockResolvedValue(VALIDO);
    versionFindFirst.mockResolvedValue({ numero: 2 });

    const r = await publicarWorkflow("wf-1", definicionInicial());

    expect(r).toEqual({ exito: true, datos: { numero: 3 } });
    expect(versionCreate.mock.calls[0][0].data).toMatchObject({ workflowId: "wf-1", instanciaId: "inst-1", numero: 3 });
    expect(workflowUpdate.mock.calls[0][0].data).toMatchObject({ estado: "PUBLICADO", versionPublicadaId: "ver-3" });
  });

  it("no publica ni guarda Workflows de otra empresa", async () => {
    workflowFindFirst.mockResolvedValue(null);
    expect(await publicarWorkflow("ajeno", definicionInicial())).toEqual({ exito: false, error: "Workflow no encontrado" });
    expect(await guardarBorradorWorkflow("ajeno", definicionInicial())).toEqual({ exito: false, error: "Workflow no encontrado" });
    expect(workflowUpdate).not.toHaveBeenCalled();
  });

  it("guardar borrador rechaza una definición con formato inválido", async () => {
    expect(await guardarBorradorWorkflow("wf-1", { nodos: "x" })).toEqual({
      exito: false,
      error: "La definición del Workflow no tiene un formato válido",
    });
  });

  describe("asignarWorkflowAEtapa", () => {
    beforeEach(() => stageFindFirst.mockResolvedValue({ id: "s-1" }));

    it("solo asigna Workflows publicados cuyo Inicio acepta 'Entrada a una etapa'", async () => {
      workflowFindFirst.mockResolvedValue(null);
      expect(await asignarWorkflowAEtapa({ pipelineId: "p", stageId: "s-1", workflowId: "wf-1" })).toEqual({
        exito: false,
        error: "Solo se pueden asignar Workflows publicados y activos",
      });

      const soloMensajes = definicionInicial();
      soloMensajes.nodos[0].config = { disparadoresAceptados: ["MENSAJE_RECIBIDO"] };
      workflowFindFirst.mockResolvedValue({ versionPublicada: { definicion: soloMensajes } });
      expect((await asignarWorkflowAEtapa({ pipelineId: "p", stageId: "s-1", workflowId: "wf-1" })).exito).toBe(false);
      expect(asignacionCreate).not.toHaveBeenCalled();
    });

    it("reemplaza la asignación anterior de la etapa", async () => {
      workflowFindFirst.mockResolvedValue({ versionPublicada: { definicion: definicionInicial() } });

      expect(await asignarWorkflowAEtapa({ pipelineId: "p", stageId: "s-1", workflowId: "wf-1" })).toEqual({ exito: true, datos: undefined });
      expect(asignacionUpdateMany).toHaveBeenCalledWith({
        where: { stageId: "s-1", instanciaId: "inst-1", activo: true, disparador: "ENTRADA_ETAPA" },
        data: { activo: false },
      });
      expect(asignacionCreate.mock.calls[0][0].data).toMatchObject({ workflowId: "wf-1", stageId: "s-1", disparador: "ENTRADA_ETAPA" });
    });

    it("con workflowId null solo quita el Workflow de la etapa", async () => {
      await asignarWorkflowAEtapa({ pipelineId: "p", stageId: "s-1", workflowId: null });
      expect(asignacionUpdateMany).toHaveBeenCalled();
      expect(asignacionCreate).not.toHaveBeenCalled();
    });

    it("etapa de otra empresa: no asigna", async () => {
      stageFindFirst.mockResolvedValue(null);
      expect(await asignarWorkflowAEtapa({ pipelineId: "p", stageId: "ajena", workflowId: null })).toEqual({
        exito: false,
        error: "Etapa no encontrada",
      });
      expect(asignacionUpdateMany).not.toHaveBeenCalled();
    });
  });
});
