import { describe, expect, it, vi, beforeEach } from "vitest";

const createMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: { respuestaPendienteRevision: { create: (...a: unknown[]) => createMock(...a) } },
}));

const { ensamblarYPersistirRegistro } = await import("./registro");

const datosBase = {
  instanciaId: "instancia-1",
  agenteIAConfigId: "agente-1",
  conversacionId: "conv-1",
  mensajeCliente: "Hola, ¿tienen stock?",
  respuestaPropuesta: "Sí, tenemos stock disponible.",
  estadoInicial: "ENVIADA_AUTOMATICAMENTE" as const,
  motivo: "Categoría CONSULTA_DISPONIBILIDAD segura para respuesta automática",
};

describe("ensamblarYPersistirRegistro (017, Historia 1)", () => {
  beforeEach(() => {
    createMock.mockReset().mockResolvedValue({ id: "registro-1" });
  });

  it("con todos los campos disponibles, persiste la fila completa", async () => {
    const id = await ensamblarYPersistirRegistro({
      ...datosBase,
      categoriaDetectada: "CONSULTA_DISPONIBILIDAD",
      usoIAId: "uso-1",
      estrategiaUtilizadaId: "estrategia-1",
      ejemplosUtilizadosIds: ["ej-1", "ej-2"],
      herramientasEjecutadas: ["consultar_disponibilidad"],
      confianza: 0.85,
      motivoTransferencia: undefined,
      productoIdentificadoId: "prod-1",
    });

    expect(id).toBe("registro-1");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: "ENVIADA_AUTOMATICAMENTE",
          motivoPendiente: datosBase.motivo,
          categoriaDetectada: "CONSULTA_DISPONIBILIDAD",
          usoIAId: "uso-1",
          estrategiaUtilizadaId: "estrategia-1",
          ejemplosUtilizadosIds: ["ej-1", "ej-2"],
          herramientasEjecutadas: ["consultar_disponibilidad"],
          confianza: 0.85,
          productoIdentificadoId: "prod-1",
        }),
      }),
    );
  });

  it("con campos ausentes (sin tools, sin estrategia, sin ejemplos), persiste sin error", async () => {
    const id = await ensamblarYPersistirRegistro(datosBase);
    expect(id).toBe("registro-1");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: "ENVIADA_AUTOMATICAMENTE", motivoPendiente: datosBase.motivo }),
      }),
    );
  });

  it("FR-010 — un fallo al persistir nunca se propaga, devuelve null", async () => {
    createMock.mockRejectedValue(new Error("DB caída"));
    const id = await ensamblarYPersistirRegistro(datosBase);
    expect(id).toBeNull();
  });
});
