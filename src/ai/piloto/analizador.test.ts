import { describe, expect, it, vi, beforeEach } from "vitest";

const pilotoFindManyMock = vi.fn();
const recomendacionCreateMock = vi.fn();
const recomendacionFindManyMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    conversacionPiloto: { findMany: (...a: unknown[]) => pilotoFindManyMock(...a) },
    recomendacionComportamiento: {
      create: (...a: unknown[]) => recomendacionCreateMock(...a),
      findMany: (...a: unknown[]) => recomendacionFindManyMock(...a),
    },
  },
}));

const generarRespuestaMock = vi.fn();
vi.mock("@/ai/gateway/gateway", () => ({
  generarRespuesta: (...a: unknown[]) => generarRespuestaMock(...a),
}));

const { ejecutarAnalisisPiloto } = await import("./analizador");

describe("ejecutarAnalisisPiloto (014, Historia 2)", () => {
  beforeEach(() => {
    pilotoFindManyMock.mockReset();
    recomendacionCreateMock.mockReset();
    recomendacionFindManyMock.mockReset().mockResolvedValue([]);
    generarRespuestaMock.mockReset();
  });

  it("sin conversaciones piloto incluidas: recomendacionesGeneradas 0, sin error (Edge Case)", async () => {
    pilotoFindManyMock.mockResolvedValue([]);
    const resultado = await ejecutarAnalisisPiloto("instancia-1");
    expect(resultado).toEqual({ exito: true, recomendacionesGeneradas: 0 });
    expect(generarRespuestaMock).not.toHaveBeenCalled();
  });

  it("con conversaciones piloto y respuesta válida: persiste recomendaciones PENDIENTE con los campos requeridos", async () => {
    pilotoFindManyMock.mockResolvedValue([
      { id: "p1", clasificacion: "NEGATIVO", explicacion: "Mala atención", contenidoAnonimizado: { mensajes: [{ rol: "user", texto: "hola" }] } },
    ]);
    generarRespuestaMock.mockResolvedValue({
      contenido: JSON.stringify({
        recomendaciones: [
          { titulo: "Responder más rápido", descripcion: "El agente tardó en responder", reglaSugerida: "Responder en menos de 1 minuto", confianza: 0.8 },
        ],
      }),
    });

    const resultado = await ejecutarAnalisisPiloto("instancia-1", "agente-1");
    expect(resultado).toEqual({ exito: true, recomendacionesGeneradas: 1 });
    expect(recomendacionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: "PENDIENTE",
          titulo: "Responder más rápido",
          basadaEnConversacionesPilotoIds: ["p1"],
        }),
      }),
    );
  });

  it("sin patrones detectados (recomendaciones vacío): recomendacionesGeneradas 0, sin error", async () => {
    pilotoFindManyMock.mockResolvedValue([
      { id: "p1", clasificacion: "POSITIVO", explicacion: "Buena atención", contenidoAnonimizado: { mensajes: [] } },
    ]);
    generarRespuestaMock.mockResolvedValue({ contenido: JSON.stringify({ recomendaciones: [] }) });
    const resultado = await ejecutarAnalisisPiloto("instancia-1");
    expect(resultado).toEqual({ exito: true, recomendacionesGeneradas: 0 });
  });

  it("no repite una recomendación equivalente a una ya rechazada (research.md Decisión 3)", async () => {
    pilotoFindManyMock.mockResolvedValue([
      { id: "p1", clasificacion: "NEGATIVO", explicacion: "Mala atención", contenidoAnonimizado: { mensajes: [] } },
    ]);
    recomendacionFindManyMock.mockResolvedValue([{ reglaSugerida: "Responder en menos de 1 minuto" }]);
    generarRespuestaMock.mockResolvedValue({
      contenido: JSON.stringify({
        recomendaciones: [
          { titulo: "X", descripcion: "Y", reglaSugerida: "¡Responder en menos de 1 minuto!", confianza: 0.9 },
        ],
      }),
    });
    const resultado = await ejecutarAnalisisPiloto("instancia-1");
    expect(resultado).toEqual({ exito: true, recomendacionesGeneradas: 0 });
    expect(recomendacionCreateMock).not.toHaveBeenCalled();
  });

  it("fallo del gateway: devuelve error explícito, no lanza", async () => {
    pilotoFindManyMock.mockResolvedValue([
      { id: "p1", clasificacion: "POSITIVO", explicacion: "Buena atención", contenidoAnonimizado: { mensajes: [] } },
    ]);
    generarRespuestaMock.mockRejectedValue(new Error("IA no habilitada"));
    const resultado = await ejecutarAnalisisPiloto("instancia-1");
    expect(resultado.exito).toBe(false);
  });
});
