import { describe, expect, it, vi, beforeEach } from "vitest";

const generarRespuestaMock = vi.fn();
const mensajeFindManyMock = vi.fn();

vi.mock("@/ai/gateway/gateway", () => ({
  generarRespuesta: (...a: unknown[]) => generarRespuestaMock(...a),
}));
vi.mock("@/shared/db/prisma", () => ({
  prisma: { mensajeConversacion: { findMany: (...a: unknown[]) => mensajeFindManyMock(...a) } },
}));

const { derivarLectura, TIMEOUT_DERIVACION_MS } = await import("./extraccion");

const JSON_VALIDO = JSON.stringify({
  tema: "esfera lunar",
  intencion: "CONSULTANDO_PRECIO",
  datosConocidos: { variante: "luna completa", ciudad: "Lima" },
  datosFaltantes: ["forma de entrega"],
  resumen: "Pregunta por una esfera lunar.",
  confianza: 0.8,
});

beforeEach(() => {
  generarRespuestaMock.mockReset();
  mensajeFindManyMock.mockReset().mockResolvedValue([
    { contenido: "¿cuánto cuesta la esfera lunar?", remitente: "CONTACTO" },
    { contenido: "Está a USD 16.", remitente: "AGENTE" },
  ]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("derivarLectura — camino feliz (031, Historia 3)", () => {
  it("devuelve la lectura con todos sus campos", async () => {
    generarRespuestaMock.mockResolvedValue({ contenido: JSON_VALIDO });

    const lectura = await derivarLectura("conv-1", "inst-1");

    expect(lectura).toMatchObject({
      tema: "esfera lunar",
      intencion: "CONSULTANDO_PRECIO",
      datosConocidos: { variante: "luna completa", ciudad: "Lima" },
      datosFaltantes: ["forma de entrega"],
      confianza: 0.8,
    });
  });

  it("sale por EXTRACCION_ENTIDADES, para que el enrutamiento de la 010 pueda mandarla a un modelo barato", async () => {
    generarRespuestaMock.mockResolvedValue({ contenido: JSON_VALIDO });

    await derivarLectura("conv-1", "inst-1");

    expect(generarRespuestaMock.mock.calls[0][0]).toMatchObject({
      tarea: "EXTRACCION_ENTIDADES",
      entidadTipo: "conversacion",
      entidadId: "conv-1",
    });
  });

  it("acota la consulta de mensajes a la instancia (FR-033)", async () => {
    generarRespuestaMock.mockResolvedValue({ contenido: JSON_VALIDO });

    await derivarLectura("conv-1", "inst-1");

    expect(mensajeFindManyMock.mock.calls[0][0].where).toMatchObject({
      conversacion: { id: "conv-1", instanciaId: "inst-1" },
    });
  });

  it("tolera el JSON envuelto en un bloque markdown", async () => {
    generarRespuestaMock.mockResolvedValue({ contenido: "```json\n" + JSON_VALIDO + "\n```" });

    expect((await derivarLectura("conv-1", "inst-1"))?.tema).toBe("esfera lunar");
  });
});

describe("derivarLectura — tolerancia a fallo (031, FR-023)", () => {
  it("devuelve null si el proveedor falla, sin lanzar", async () => {
    generarRespuestaMock.mockRejectedValue(new Error("proveedor caído"));

    expect(await derivarLectura("conv-1", "inst-1")).toBeNull();
  });

  it("devuelve null si la respuesta no es JSON", async () => {
    generarRespuestaMock.mockResolvedValue({ contenido: "Claro, con gusto te ayudo." });

    expect(await derivarLectura("conv-1", "inst-1")).toBeNull();
  });

  it("devuelve null si el JSON es un arreglo en vez de un objeto", async () => {
    generarRespuestaMock.mockResolvedValue({ contenido: "[1,2,3]" });

    expect(await derivarLectura("conv-1", "inst-1")).toBeNull();
  });

  it("devuelve null cuando la conversación no tiene mensajes con texto", async () => {
    mensajeFindManyMock.mockResolvedValue([{ contenido: null, remitente: "CONTACTO" }]);

    expect(await derivarLectura("conv-1", "inst-1")).toBeNull();
    expect(generarRespuestaMock).not.toHaveBeenCalled();
  });

  it("corta por timeout si el proveedor no responde", async () => {
    vi.useFakeTimers();
    generarRespuestaMock.mockImplementation(() => new Promise(() => {}));

    const promesa = derivarLectura("conv-1", "inst-1");
    await vi.advanceTimersByTimeAsync(TIMEOUT_DERIVACION_MS + 1);

    expect(await promesa).toBeNull();
    vi.useRealTimers();
  });
});

describe("derivarLectura — validación de lo que devuelve el modelo (031, FR-021)", () => {
  it("descarta una intención que no existe en el vocabulario de Karia", async () => {
    generarRespuestaMock.mockResolvedValue({
      contenido: JSON.stringify({ ...JSON.parse(JSON_VALIDO), intencion: "QUIERE_COMPRAR_YA" }),
    });

    expect((await derivarLectura("conv-1", "inst-1"))?.intencion).toBeNull();
  });

  it("descarta valores no textuales dentro de datosConocidos", async () => {
    generarRespuestaMock.mockResolvedValue({
      contenido: JSON.stringify({ ...JSON.parse(JSON_VALIDO), datosConocidos: { ciudad: "Lima", cantidad: 3, nota: null } }),
    });

    expect((await derivarLectura("conv-1", "inst-1"))?.datosConocidos).toEqual({ ciudad: "Lima" });
  });

  it("normaliza datosFaltantes cuando no viene como arreglo", async () => {
    generarRespuestaMock.mockResolvedValue({
      contenido: JSON.stringify({ ...JSON.parse(JSON_VALIDO), datosFaltantes: "la ciudad" }),
    });

    expect((await derivarLectura("conv-1", "inst-1"))?.datosFaltantes).toEqual([]);
  });

  it("usa 0.5 de confianza cuando el modelo no la devuelve", async () => {
    generarRespuestaMock.mockResolvedValue({
      contenido: JSON.stringify({ ...JSON.parse(JSON_VALIDO), confianza: "alta" }),
    });

    expect((await derivarLectura("conv-1", "inst-1"))?.confianza).toBe(0.5);
  });
});
