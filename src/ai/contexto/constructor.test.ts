import { describe, expect, it, vi, beforeEach } from "vitest";

// Regresión de la cadena real de una conversación (la que usa
// responderConAgente), que es distinta de la del simulador: el simulador lee
// la fila entera de AgenteIAConfig y acá hay un `select` explícito. Cuando
// ese select se quedó sin `instruccionesAgente`, el bloque de instrucciones
// que el negocio escribe en el modal no llegaba al modelo en producción
// aunque en el Simulador se viera perfecto.

const agenteFindUniqueMock = vi.fn();
const construirContextoCompuestoMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    conversacion: { findUnique: vi.fn().mockResolvedValue(null) },
    contacto: { findUnique: vi.fn().mockResolvedValue(null) },
    oportunidad: { findUnique: vi.fn().mockResolvedValue(null) },
    agenteIAConfig: { findUnique: (...a: unknown[]) => agenteFindUniqueMock(...a) },
  },
}));
vi.mock("./context-builder", () => ({
  construirContextoCompuesto: (...a: unknown[]) => construirContextoCompuestoMock(...a),
}));
vi.mock("./router", () => ({
  resolverDecisionContexto: () => ({ mensajesAIncluir: 10 }),
}));

const { construirContexto } = await import("./constructor");

const INSTRUCCIONES = "# Rol\nSos el asesor de Decostore.\n7. Métodos de pago: se le comparte @plantilla:metodo_de_pago";

beforeEach(() => {
  agenteFindUniqueMock.mockReset().mockResolvedValue({
    instruccionesAgente: INSTRUCCIONES,
    objetivo: "ventas",
    personalidad: null,
    especialidad: null,
    instrucciones: null,
    sistemaPrompt: null,
    configuracionTono: null,
    limiteTokensCtx: 4000,
    respuestasGuia: null,
    catalogoEnContexto: true,
    limiteCatalogoContexto: 30,
  });
  construirContextoCompuestoMock.mockReset().mockResolvedValue({
    systemPrompt: "prompt",
    estrategiaSeleccionada: null,
    perfilClienteUsado: false,
    ejemplosUtilizadosIds: [],
  });
});

describe("construirContexto — instrucciones del agente", () => {
  it("pide instruccionesAgente en el select", async () => {
    await construirContexto({ instanciaId: "inst-1", agenteIAConfigId: "ag-1" });

    expect(agenteFindUniqueMock.mock.calls[0][0].select).toMatchObject({ instruccionesAgente: true });
  });

  it("se lo pasa a construirContextoCompuesto, que es quien expande las referencias `@`", async () => {
    await construirContexto({ instanciaId: "inst-1", agenteIAConfigId: "ag-1" });

    const { configAgente } = construirContextoCompuestoMock.mock.calls[0][1];
    expect(configAgente.instruccionesAgente).toBe(INSTRUCCIONES);
  });
});
