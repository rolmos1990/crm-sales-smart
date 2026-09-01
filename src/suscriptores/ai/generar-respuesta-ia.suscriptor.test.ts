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

// 017-aprendizaje-supervisado-auditoria — el suscriptor llama a
// ensamblarYPersistirRegistro directamente (registro.ts), no ya a
// crearRespuestaPendiente (actions.ts, que ahora delega en el mismo
// ensamblador — T010, unificación sin duplicación).
const ensamblarYPersistirRegistroMock = vi.fn();
vi.mock("@/ai/autonomia/registro", () => ({
  ensamblarYPersistirRegistro: (...a: unknown[]) => ensamblarYPersistirRegistroMock(...a),
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

describe("GenerarRespuestaIASuscriptor — gate de autonomía (016, Historia 2) y registro (017, Historia 1)", () => {
  beforeEach(() => {
    conversacionFindUniqueMock.mockReset().mockResolvedValue({
      contactoId: "contacto-1",
      instanciaId: "instancia-1",
      oportunidades: [],
    });
    agenteIAConfigFindUniqueMock.mockReset().mockResolvedValue({ herramientas: null });
    mensajeFindFirstMock.mockReset().mockResolvedValue({ contenido: "Hola, ¿tienen el producto X?" });
    generarRespuestaMock.mockReset().mockResolvedValue({ contenido: "Sí, tenemos disponibilidad.", usoIAId: "uso-1" });
    enviarMensajeMock.mockReset().mockResolvedValue({ ok: true, mensaje: { id: "m1" } });
    obtenerAutonomiaPorAgenteMock.mockReset();
    clasificarCategoriaIntencionMock.mockReset();
    ensamblarYPersistirRegistroMock.mockReset().mockResolvedValue("registro-1");
  });

  it("agente sin ninguna fila de AutonomiaIntencionConfig: nunca invoca clasificarCategoriaIntencion, envía normalmente y registra ENVIADA_AUTOMATICAMENTE (FR-004, 017 Historia 1)", async () => {
    obtenerAutonomiaPorAgenteMock.mockResolvedValue(null);

    const suscriptor = new GenerarRespuestaIASuscriptor();
    await suscriptor.manejar(envelope("agente-1"));

    expect(obtenerAutonomiaPorAgenteMock).toHaveBeenCalledWith("agente-1");
    expect(clasificarCategoriaIntencionMock).not.toHaveBeenCalled();
    expect(enviarMensajeMock).toHaveBeenCalledWith(expect.objectContaining({ contenido: "Sí, tenemos disponibilidad." }));
    expect(ensamblarYPersistirRegistroMock).toHaveBeenCalledWith(
      expect.objectContaining({ estadoInicial: "ENVIADA_AUTOMATICAMENTE", agenteIAConfigId: "agente-1", usoIAId: "uso-1" }),
    );
  });

  it("agente con HUMAN_ONLY para la categoría detectada: no genera, no envía y no registra nada", async () => {
    obtenerAutonomiaPorAgenteMock.mockResolvedValue(
      new Map([["RECLAMO", { categoria: "RECLAMO", nivel: "HUMAN_ONLY", condicionesConfianza: null }]]),
    );
    clasificarCategoriaIntencionMock.mockResolvedValue({ categorias: [{ categoria: "RECLAMO", confianza: 0.9 }] });

    const suscriptor = new GenerarRespuestaIASuscriptor();
    await suscriptor.manejar(envelope("agente-1"));

    expect(enviarMensajeMock).not.toHaveBeenCalled();
    expect(ensamblarYPersistirRegistroMock).not.toHaveBeenCalled();
  });

  it("agente con SUGGESTION_ONLY para la categoría detectada: registra PENDIENTE y no envía", async () => {
    obtenerAutonomiaPorAgenteMock.mockResolvedValue(
      new Map([["CONSULTA_PRECIO", { categoria: "CONSULTA_PRECIO", nivel: "SUGGESTION_ONLY", condicionesConfianza: null }]]),
    );
    clasificarCategoriaIntencionMock.mockResolvedValue({ categorias: [{ categoria: "CONSULTA_PRECIO", confianza: 0.9 }] });

    const suscriptor = new GenerarRespuestaIASuscriptor();
    await suscriptor.manejar(envelope("agente-1"));

    expect(enviarMensajeMock).not.toHaveBeenCalled();
    expect(ensamblarYPersistirRegistroMock).toHaveBeenCalledWith(
      expect.objectContaining({
        estadoInicial: "PENDIENTE",
        agenteIAConfigId: "agente-1",
        conversacionId: "conv-1",
        categoriaDetectada: "CONSULTA_PRECIO",
        confianza: 0.9,
      }),
    );
  });

  it("fallo del clasificador (devuelve null): se envía igual que el comportamiento por defecto (FR-010) y registra ENVIADA_AUTOMATICAMENTE", async () => {
    obtenerAutonomiaPorAgenteMock.mockResolvedValue(
      new Map([["RECLAMO", { categoria: "RECLAMO", nivel: "HUMAN_ONLY", condicionesConfianza: null }]]),
    );
    clasificarCategoriaIntencionMock.mockResolvedValue(null);

    const suscriptor = new GenerarRespuestaIASuscriptor();
    await suscriptor.manejar(envelope("agente-1"));

    expect(enviarMensajeMock).toHaveBeenCalled();
    expect(ensamblarYPersistirRegistroMock).toHaveBeenCalledWith(expect.objectContaining({ estadoInicial: "ENVIADA_AUTOMATICAMENTE" }));
  });

  it("sin agenteId resuelto: no registra nada (el registro requiere un agente conocido)", async () => {
    agenteIAConfigFindUniqueMock.mockReset();
    obtenerAutonomiaPorAgenteMock.mockResolvedValue(null);

    const suscriptor = new GenerarRespuestaIASuscriptor();
    await suscriptor.manejar(envelope(undefined));

    expect(enviarMensajeMock).toHaveBeenCalled();
    expect(ensamblarYPersistirRegistroMock).not.toHaveBeenCalled();
  });
});
