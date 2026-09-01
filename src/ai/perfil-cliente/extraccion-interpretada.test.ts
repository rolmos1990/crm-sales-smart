import { describe, expect, it, vi, beforeEach } from "vitest";

const mensajeFindManyMock = vi.fn();
const generarRespuestaMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: { mensajeConversacion: { findMany: (...args: unknown[]) => mensajeFindManyMock(...args) } },
}));
vi.mock("@/ai/gateway/gateway", () => ({
  generarRespuesta: (...args: unknown[]) => generarRespuestaMock(...args),
}));

const { extraerDatosInterpretados } = await import("./extraccion-interpretada");

describe("extraerDatosInterpretados (012, FR-007)", () => {
  beforeEach(() => {
    mensajeFindManyMock.mockReset();
    generarRespuestaMock.mockReset();
  });

  it("devuelve null sin llamar a la IA cuando no hay mensajes recientes", async () => {
    mensajeFindManyMock.mockResolvedValue([]);
    const resultado = await extraerDatosInterpretados("contacto-1", "instancia-1");
    expect(resultado).toBeNull();
    expect(generarRespuestaMock).not.toHaveBeenCalled();
  });

  it("parsea una respuesta válida del gateway", async () => {
    mensajeFindManyMock.mockResolvedValue([
      { contenido: "Busco algo para un cumpleaños, presupuesto hasta $500", remitente: "CONTACTO" },
    ]);
    generarRespuestaMock.mockResolvedValue({
      contenido: JSON.stringify({
        intencionComercialActual: "SOLICITANDO_RECOMENDACION",
        productosConsultados: ["torta"],
        preferenciasIdentificadas: ["chocolate"],
        presupuestoConocido: "hasta $500",
        ocasionActual: "cumpleaños",
        fechaRequerida: null,
        confianza: 0.8,
      }),
    });

    const resultado = await extraerDatosInterpretados("contacto-1", "instancia-1");
    expect(resultado).not.toBeNull();
    expect(resultado?.presupuestoConocido).toBe("hasta $500");
    expect(resultado?.ocasionActual).toBe("cumpleaños");
    expect(resultado?.confianza).toBe(0.8);
  });

  it("devuelve null sin lanzar cuando el gateway falla (IA no habilitada u otro error)", async () => {
    mensajeFindManyMock.mockResolvedValue([{ contenido: "hola", remitente: "CONTACTO" }]);
    generarRespuestaMock.mockRejectedValue(new Error("IA no habilitada para esta instancia"));

    const resultado = await extraerDatosInterpretados("contacto-1", "instancia-1");
    expect(resultado).toBeNull();
  });

  it("devuelve null cuando la respuesta no es JSON parseable", async () => {
    mensajeFindManyMock.mockResolvedValue([{ contenido: "hola", remitente: "CONTACTO" }]);
    generarRespuestaMock.mockResolvedValue({ contenido: "no soy json" });

    const resultado = await extraerDatosInterpretados("contacto-1", "instancia-1");
    expect(resultado).toBeNull();
  });
});
