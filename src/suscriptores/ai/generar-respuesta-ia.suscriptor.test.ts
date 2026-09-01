import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/ai/tools/inicializar", () => ({}));

const conversacionFindUniqueMock = vi.fn();
const agenteIAConfigFindUniqueMock = vi.fn();
const mensajeFindFirstMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    conversacion: { findUnique: (...a: unknown[]) => conversacionFindUniqueMock(...a) },
    agenteIAConfig: { findUnique: (...a: unknown[]) => agenteIAConfigFindUniqueMock(...a), findFirst: vi.fn() },
    mensajeConversacion: { findFirst: (...a: unknown[]) => mensajeFindFirstMock(...a) },
  },
}));

const generarRespuestaMock = vi.fn();
vi.mock("@/ai/gateway/gateway", () => ({
  generarRespuesta: (...a: unknown[]) => generarRespuestaMock(...a),
  generarConHerramientas: vi.fn(),
}));

vi.mock("@/ai/contexto/constructor", () => ({
  construirContexto: vi.fn().mockResolvedValue({}),
  serializarContextoComoMensajes: vi.fn().mockReturnValue([{ rol: "system", contenido: "Eres un asistente." }]),
}));

const enviarMensajeMock = vi.fn();
vi.mock("@/conversaciones/actions", () => ({
  enviarMensaje: (...a: unknown[]) => enviarMensajeMock(...a),
}));

const obtenerAutonomiaPorAgenteMock = vi.fn();
vi.mock("@/ai/autonomia/queries", () => ({
  obtenerAutonomiaPorAgente: (...a: unknown[]) => obtenerAutonomiaPorAgenteMock(...a),
}));

const clasificarCategoriaIntencionMock = vi.fn();
vi.mock("@/ai/autonomia/clasificador", () => ({
  clasificarCategoriaIntencion: (...a: unknown[]) => clasificarCategoriaIntencionMock(...a),
}));

const crearRespuestaPendienteMock = vi.fn();
vi.mock("@/ai/autonomia/actions", () => ({
  crearRespuestaPendiente: (...a: unknown[]) => crearRespuestaPendienteMock(...a),
}));

vi.mock("@/ai/perfil-cliente/servicio", () => ({
  obtenerPerfil: vi.fn().mockResolvedValue(null),
}));

const { GenerarRespuestaIASuscriptor } = await import("./generar-respuesta-ia.suscriptor");

function envelope(agenteIAConfigId?: string) {
  return {
    payload: { conversacionId: "conv-1", instanciaId: "instancia-1", agenteIAConfigId },
  } as never;
}

describe("GenerarRespuestaIASuscriptor — gate de autonomía (016, Historia 2)", () => {
  beforeEach(() => {
    conversacionFindUniqueMock.mockReset().mockResolvedValue({
      contactoId: "contacto-1",
      instanciaId: "instancia-1",
      oportunidades: [],
    });
    agenteIAConfigFindUniqueMock.mockReset().mockResolvedValue({ herramientas: null });
    mensajeFindFirstMock.mockReset().mockResolvedValue({ contenido: "Hola, ¿tienen el producto X?" });
    generarRespuestaMock.mockReset().mockResolvedValue({ contenido: "Sí, tenemos disponibilidad." });
    enviarMensajeMock.mockReset().mockResolvedValue({ ok: true, mensaje: { id: "m1" } });
    obtenerAutonomiaPorAgenteMock.mockReset();
    clasificarCategoriaIntencionMock.mockReset();
    crearRespuestaPendienteMock.mockReset();
  });

  it("agente sin ninguna fila de AutonomiaIntencionConfig: nunca invoca clasificarCategoriaIntencion y envía normalmente (FR-004)", async () => {
    obtenerAutonomiaPorAgenteMock.mockResolvedValue(null);

    const suscriptor = new GenerarRespuestaIASuscriptor();
    await suscriptor.manejar(envelope("agente-1"));

    expect(obtenerAutonomiaPorAgenteMock).toHaveBeenCalledWith("agente-1");
    expect(clasificarCategoriaIntencionMock).not.toHaveBeenCalled();
    expect(crearRespuestaPendienteMock).not.toHaveBeenCalled();
    expect(enviarMensajeMock).toHaveBeenCalledWith(expect.objectContaining({ contenido: "Sí, tenemos disponibilidad." }));
  });

  it("agente con HUMAN_ONLY para la categoría detectada: no genera ni envía nada", async () => {
    obtenerAutonomiaPorAgenteMock.mockResolvedValue(
      new Map([["RECLAMO", { categoria: "RECLAMO", nivel: "HUMAN_ONLY", condicionesConfianza: null }]]),
    );
    clasificarCategoriaIntencionMock.mockResolvedValue({ categorias: [{ categoria: "RECLAMO", confianza: 0.9 }] });

    const suscriptor = new GenerarRespuestaIASuscriptor();
    await suscriptor.manejar(envelope("agente-1"));

    expect(enviarMensajeMock).not.toHaveBeenCalled();
    expect(crearRespuestaPendienteMock).not.toHaveBeenCalled();
  });

  it("agente con SUGGESTION_ONLY para la categoría detectada: crea RespuestaPendienteRevision y no envía", async () => {
    obtenerAutonomiaPorAgenteMock.mockResolvedValue(
      new Map([["CONSULTA_PRECIO", { categoria: "CONSULTA_PRECIO", nivel: "SUGGESTION_ONLY", condicionesConfianza: null }]]),
    );
    clasificarCategoriaIntencionMock.mockResolvedValue({ categorias: [{ categoria: "CONSULTA_PRECIO", confianza: 0.9 }] });

    const suscriptor = new GenerarRespuestaIASuscriptor();
    await suscriptor.manejar(envelope("agente-1"));

    expect(enviarMensajeMock).not.toHaveBeenCalled();
    expect(crearRespuestaPendienteMock).toHaveBeenCalledWith(
      expect.objectContaining({ agenteIAConfigId: "agente-1", conversacionId: "conv-1", categoriaDetectada: "CONSULTA_PRECIO" }),
    );
  });

  it("fallo del clasificador (devuelve null): se envía igual que el comportamiento por defecto (FR-010)", async () => {
    obtenerAutonomiaPorAgenteMock.mockResolvedValue(
      new Map([["RECLAMO", { categoria: "RECLAMO", nivel: "HUMAN_ONLY", condicionesConfianza: null }]]),
    );
    clasificarCategoriaIntencionMock.mockResolvedValue(null);

    const suscriptor = new GenerarRespuestaIASuscriptor();
    await suscriptor.manejar(envelope("agente-1"));

    expect(enviarMensajeMock).toHaveBeenCalled();
    expect(crearRespuestaPendienteMock).not.toHaveBeenCalled();
  });
});
