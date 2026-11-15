import { describe, expect, it, vi, beforeEach } from "vitest";

const oportunidadFindFirstMock = vi.fn();
const pipelineStageFindManyMock = vi.fn();
const moverOportunidadAEtapaMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    oportunidad: { findFirst: (...a: unknown[]) => oportunidadFindFirstMock(...a) },
    pipelineStage: { findMany: (...a: unknown[]) => pipelineStageFindManyMock(...a) },
  },
}));
vi.mock("@/crm/pipeline/mover-stage", () => ({
  moverOportunidadAEtapa: (...a: unknown[]) => moverOportunidadAEtapaMock(...a),
}));

await import("./actualizar-etapa-oportunidad.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const tool = () => registroHerramientas.get("actualizar_etapa_oportunidad")!;

const ctx = {
  instanciaId: "instancia-1",
  conversacionId: "conv-1",
  oportunidadId: "op-1",
  herramientasPermitidas: ["actualizar_etapa_oportunidad"],
};

const STAGES = [
  { id: "s1", nombre: "Nuevo Cliente" },
  { id: "s2", nombre: "Cliente potencial" },
  { id: "s3", nombre: "Pagado" },
];

describe("actualizar_etapa_oportunidad", () => {
  beforeEach(() => {
    oportunidadFindFirstMock
      .mockReset()
      .mockResolvedValue({ id: "op-1", pipelineId: "pipe-1", stageId: "s1" });
    pipelineStageFindManyMock.mockReset().mockResolvedValue(STAGES);
    moverOportunidadAEtapaMock.mockReset().mockResolvedValue({ exito: true, historialId: "h1" });
  });

  it("mueve la oportunidad con origen IA, que es lo que hace que corran los disparadores y workflows", async () => {
    const resultado = await tool().execute({ etapa: "Pagado", motivo: "El cliente confirmó el pago" }, ctx);

    expect(resultado.ok).toBe(true);
    expect(moverOportunidadAEtapaMock).toHaveBeenCalledWith({
      oportunidadId: "op-1",
      stageId: "s3",
      pipelineId: "pipe-1",
      instanciaId: "instancia-1",
      origen: { tipo: "IA" },
      motivo: "El cliente confirmó el pago",
    });
  });

  it("resuelve la etapa sin importar tildes ni mayúsculas: el negocio escribe sus reglas a mano", async () => {
    await tool().execute({ etapa: "  cliente POTENCIAL " }, ctx);

    expect(moverOportunidadAEtapaMock).toHaveBeenCalledWith(
      expect.objectContaining({ stageId: "s2" }),
    );
  });

  it("ante un nombre inexistente devuelve la lista de etapas válidas, para que el modelo se corrija", async () => {
    const resultado = await tool().execute({ etapa: "Facturado" }, ctx);

    expect(resultado.ok).toBe(false);
    expect(resultado.error).toContain("Facturado");
    expect(resultado.error).toContain("Nuevo Cliente, Cliente potencial, Pagado");
    expect(moverOportunidadAEtapaMock).not.toHaveBeenCalled();
  });

  it("sin oportunidad en el contexto no mueve nada", async () => {
    const { oportunidadId, ...sinOportunidad } = ctx;
    void oportunidadId;

    const resultado = await tool().execute({ etapa: "Pagado" }, sinOportunidad);

    expect(resultado.ok).toBe(false);
    expect(resultado.error).toContain("no tiene una oportunidad asociada");
    expect(oportunidadFindFirstMock).not.toHaveBeenCalled();
  });

  it("una oportunidad de otra instancia no se encuentra (aislamiento multi-tenant)", async () => {
    oportunidadFindFirstMock.mockResolvedValue(null);

    const resultado = await tool().execute({ etapa: "Pagado" }, ctx);

    expect(resultado.ok).toBe(false);
    expect(moverOportunidadAEtapaMock).not.toHaveBeenCalled();
    // El filtro de instancia sale del contexto del backend, nunca de los args.
    expect(oportunidadFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "op-1", instanciaId: "instancia-1" } }),
    );
  });

  it("si ya está en esa etapa no llama al servicio: mover dispararía automatizaciones de nuevo", async () => {
    const resultado = await tool().execute({ etapa: "Nuevo Cliente" }, ctx);

    expect(resultado.ok).toBe(true);
    expect(moverOportunidadAEtapaMock).not.toHaveBeenCalled();
  });

  it("propaga el error de campos requeridos tal cual: es información que el agente puede pedirle al cliente", async () => {
    moverOportunidadAEtapaMock.mockResolvedValue({
      exito: false,
      error: 'Para avanzar a "Pagado" debes completar: Número de factura',
    });

    const resultado = await tool().execute({ etapa: "Pagado" }, ctx);

    expect(resultado.ok).toBe(false);
    expect(resultado.error).toContain("Número de factura");
  });

  it("una oportunidad fuera de todo pipeline no se puede mover", async () => {
    oportunidadFindFirstMock.mockResolvedValue({ id: "op-1", pipelineId: null, stageId: null });

    const resultado = await tool().execute({ etapa: "Pagado" }, ctx);

    expect(resultado.ok).toBe(false);
    expect(resultado.error).toContain("no está en ningún pipeline");
  });

  it("en modo simulación valida el nombre pero no mueve nada", async () => {
    const resultado = await tool().execute({ etapa: "Pagado" }, { ...ctx, modoSimulacion: true });

    expect(resultado.ok).toBe(true);
    expect((resultado.data as { previsualizado: boolean }).previsualizado).toBe(true);
    expect(moverOportunidadAEtapaMock).not.toHaveBeenCalled();

    const invalido = await tool().execute({ etapa: "Facturado" }, { ...ctx, modoSimulacion: true });
    expect(invalido.ok).toBe(false);
  });
});
