import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const procesarCambioStageMock = vi.fn();
vi.mock("./disparadores/motor", () => ({
  procesarCambioStage: (...a: unknown[]) => procesarCambioStageMock(...a),
}));

const publicarMock = vi.fn();
vi.mock("@/shared/rabbitmq", () => ({
  publicadorEventos: { publicar: (...a: unknown[]) => publicarMock(...a) },
}));

const oportunidadFindUnique = vi.fn();
const oportunidadUpdate = vi.fn();
const stageFindUnique = vi.fn();
const camposFindMany = vi.fn();
const historialCreate = vi.fn();
const historialCount = vi.fn();
const linksFindMany = vi.fn();
const conversacionUpdateMany = vi.fn();
const transaction = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    oportunidad: {
      findUnique: (...a: unknown[]) => oportunidadFindUnique(...a),
      update: (...a: unknown[]) => oportunidadUpdate(...a),
    },
    pipelineStage: { findUnique: (...a: unknown[]) => stageFindUnique(...a) },
    campoPersonalizado: { findMany: (...a: unknown[]) => camposFindMany(...a) },
    oportunidadHistorialEtapa: {
      create: (...a: unknown[]) => historialCreate(...a),
      count: (...a: unknown[]) => historialCount(...a),
    },
    oportunidadConversacion: { findMany: (...a: unknown[]) => linksFindMany(...a) },
    conversacion: { updateMany: (...a: unknown[]) => conversacionUpdateMany(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

const { moverOportunidadAEtapa, registrarEntradaInicialAEtapa } = await import("./mover-stage");

const base = {
  oportunidadId: "op-1",
  stageId: "stage-B",
  pipelineId: "pipe-1",
  instanciaId: "inst-1",
  origen: { tipo: "USUARIO" as const, usuarioId: "user-1" },
};

function stage(extra: Record<string, unknown> = {}) {
  return {
    nombre: "Negociación",
    probabilidad: 60,
    esGanado: false,
    esPerdido: false,
    pipelineId: "pipe-1",
    pipeline: { instanciaId: "inst-1" },
    ...extra,
  };
}

describe("moverOportunidadAEtapa — servicio único de cambio de etapa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    oportunidadFindUnique.mockResolvedValue({
      instanciaId: "inst-1",
      stageId: "stage-A",
      pipelineId: "pipe-1",
      metadata: {},
    });
    stageFindUnique.mockResolvedValue(stage());
    camposFindMany.mockResolvedValue([]);
    historialCount.mockResolvedValue(0);
    oportunidadUpdate.mockResolvedValue({});
    historialCreate.mockResolvedValue({ id: "hist-1" });
    linksFindMany.mockResolvedValue([]);
    transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    procesarCambioStageMock.mockResolvedValue(undefined);
    publicarMock.mockResolvedValue(undefined);
  });

  it("mueve: actualiza etapa y probabilidad, guarda historial, encola disparadores y publica el evento", async () => {
    const r = await moverOportunidadAEtapa(base);

    expect(r).toEqual({ exito: true, historialId: "hist-1" });
    expect(oportunidadUpdate).toHaveBeenCalledWith({
      where: { id: "op-1" },
      data: { stageId: "stage-B", pipelineId: "pipe-1", probabilidad: 60 },
    });
    expect(historialCreate.mock.calls[0][0].data).toMatchObject({
      oportunidadId: "op-1",
      instanciaId: "inst-1",
      stageAnteriorId: "stage-A",
      stageNuevoId: "stage-B",
      origen: "USUARIO",
      usuarioId: "user-1",
    });
    expect(procesarCambioStageMock).toHaveBeenCalledWith("op-1", "stage-B", "pipe-1");
    expect(publicarMock).toHaveBeenCalledWith(
      "OPORTUNIDAD_MOVIDA_DE_ETAPA",
      "inst-1",
      expect.objectContaining({ version: 1, historialId: "hist-1", stageAnteriorId: "stage-A", stageNuevoId: "stage-B" }),
    );
  });

  it("misma etapa: no hace nada (ni historial ni disparadores)", async () => {
    oportunidadFindUnique.mockResolvedValue({ instanciaId: "inst-1", stageId: "stage-B", pipelineId: "pipe-1", metadata: {} });

    expect(await moverOportunidadAEtapa(base)).toEqual({ exito: true, historialId: null });
    expect(transaction).not.toHaveBeenCalled();
    expect(procesarCambioStageMock).not.toHaveBeenCalled();
  });

  it("oportunidad de otra instancia: no la mueve", async () => {
    oportunidadFindUnique.mockResolvedValue({ instanciaId: "otra", stageId: "stage-A", pipelineId: "pipe-1", metadata: {} });

    expect(await moverOportunidadAEtapa(base)).toEqual({ exito: false, error: "Oportunidad no encontrada" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("etapa que no pertenece al pipeline indicado: no la mueve", async () => {
    stageFindUnique.mockResolvedValue(stage({ pipelineId: "pipe-otro" }));

    expect(await moverOportunidadAEtapa(base)).toEqual({ exito: false, error: "Etapa no encontrada" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("campos requeridos faltantes: bloquea; con validarCamposRequeridos=false mueve igual", async () => {
    camposFindMany.mockResolvedValue([{ nombre: "Presupuesto", clave: "presupuesto", requeridoEn: ["stage-B"] }]);

    const bloqueado = await moverOportunidadAEtapa(base);
    expect(bloqueado).toEqual({ exito: false, error: 'Para avanzar a "Negociación" debes completar: Presupuesto' });
    expect(transaction).not.toHaveBeenCalled();

    const sinValidar = await moverOportunidadAEtapa({ ...base, validarCamposRequeridos: false });
    expect(sinValidar.exito).toBe(true);
  });

  it("anti-ciclo: demasiados movimientos automáticos en la última hora detienen el disparador", async () => {
    historialCount.mockResolvedValue(20);

    const r = await moverOportunidadAEtapa({ ...base, origen: { tipo: "DISPARADOR" } });
    expect(r.exito).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("un movimiento manual no cuenta para el anti-ciclo", async () => {
    historialCount.mockResolvedValue(100);

    expect((await moverOportunidadAEtapa(base)).exito).toBe(true);
    expect(historialCount).not.toHaveBeenCalled();
  });

  it("etapa Ganado: marca GANADO con fecha y cierra las conversaciones", async () => {
    stageFindUnique.mockResolvedValue(stage({ nombre: "Ganado", probabilidad: 100, esGanado: true }));
    linksFindMany.mockResolvedValue([{ conversacionId: "conv-1" }]);

    await moverOportunidadAEtapa(base);

    expect(oportunidadUpdate.mock.calls[0][0].data).toMatchObject({ etapa: "GANADO", probabilidad: 100 });
    expect(oportunidadUpdate.mock.calls[0][0].data.fechaGanada).toBeInstanceOf(Date);
    expect(conversacionUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["conv-1"] }, estado: { not: "CERRADA" } },
      data: { estado: "CERRADA" },
    });
  });

  it("si RabbitMQ falla, el movimiento igual queda guardado", async () => {
    publicarMock.mockRejectedValue(new Error("sin conexión"));

    expect(await moverOportunidadAEtapa(base)).toEqual({ exito: true, historialId: "hist-1" });
  });
});

describe("registrarEntradaInicialAEtapa — oportunidades creadas ya en una etapa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historialCreate.mockResolvedValue({ id: "hist-0" });
    procesarCambioStageMock.mockResolvedValue(undefined);
    publicarMock.mockResolvedValue(undefined);
  });

  it("guarda historial sin etapa anterior, encola disparadores y publica el evento", async () => {
    await registrarEntradaInicialAEtapa({
      oportunidadId: "op-9",
      stageId: "stage-inicial",
      pipelineId: "pipe-1",
      instanciaId: "inst-1",
      origen: { tipo: "SISTEMA" },
      motivo: "Lead entrante",
    });

    expect(historialCreate.mock.calls[0][0].data).toMatchObject({
      stageAnteriorId: null,
      stageNuevoId: "stage-inicial",
      origen: "SISTEMA",
      motivo: "Lead entrante",
    });
    expect(procesarCambioStageMock).toHaveBeenCalledWith("op-9", "stage-inicial", "pipe-1");
    expect(publicarMock).toHaveBeenCalledWith(
      "OPORTUNIDAD_MOVIDA_DE_ETAPA",
      "inst-1",
      expect.objectContaining({ stageAnteriorId: null, historialId: "hist-0" }),
    );
  });

  it("un error no se propaga (la oportunidad ya fue creada)", async () => {
    historialCreate.mockRejectedValue(new Error("db caída"));

    await expect(
      registrarEntradaInicialAEtapa({
        oportunidadId: "op-9",
        stageId: "s",
        pipelineId: "p",
        instanciaId: "inst-1",
        origen: { tipo: "SISTEMA" },
      }),
    ).resolves.toBeUndefined();
  });
});
