import { describe, expect, it, vi, beforeEach } from "vitest";

const generarRespuestaMock = vi.fn();
vi.mock("@/ai/gateway/gateway", () => ({ generarRespuesta: (...a: unknown[]) => generarRespuestaMock(...a) }));

const { destilarDocumento, recortarEnLimite } = await import("./destilado");
const { MAX_CARACTERES_DOCUMENTO } = await import("./tipos");

const TEXTO = "Politica de envios de la empresa. ".repeat(400);

beforeEach(() => {
  generarRespuestaMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("recortarEnLimite", () => {
  it("no toca un texto que ya entra", () => {
    expect(recortarEnLimite("corto", 100)).toBe("corto");
  });

  it("corta en el último salto de línea para no partir una frase", () => {
    const texto = "linea uno\nlinea dos\nlinea tres que sobra";
    expect(recortarEnLimite(texto, 22)).toBe("linea uno\nlinea dos");
  });

  it("corta duro cuando el último corte limpio está demasiado atrás", () => {
    const texto = "a".repeat(10) + " " + "b".repeat(90);
    expect(recortarEnLimite(texto, 50)).toHaveLength(50);
  });
});

describe("destilarDocumento — camino feliz", () => {
  it("devuelve el destilado y lo marca como tal", async () => {
    generarRespuestaMock.mockResolvedValue({ contenido: "envios: 2 a 5 dias habiles a todo el pais, costo segun destino" });

    const r = await destilarDocumento(TEXTO, "inst-1");

    expect(r).toEqual({ contenido: "envios: 2 a 5 dias habiles a todo el pais, costo segun destino", destilado: true });
  });

  it("sale por TareaIA.RESUMEN, ruteable a un modelo económico", async () => {
    generarRespuestaMock.mockResolvedValue({ contenido: "x".repeat(100) });

    await destilarDocumento(TEXTO, "inst-1");

    expect(generarRespuestaMock.mock.calls[0][0]).toMatchObject({ tarea: "RESUMEN", instanciaId: "inst-1" });
  });

  it("recorta el destilado si el modelo se pasó del tope", async () => {
    generarRespuestaMock.mockResolvedValue({ contenido: "y".repeat(MAX_CARACTERES_DOCUMENTO + 500) });

    const r = await destilarDocumento(TEXTO, "inst-1");

    expect(r.contenido.length).toBeLessThanOrEqual(MAX_CARACTERES_DOCUMENTO);
  });
});

describe("destilarDocumento — tolerancia a fallo (no se tira lo que sí se leyó)", () => {
  it("si el proveedor falla, conserva el texto crudo recortado y marca para revisar", async () => {
    generarRespuestaMock.mockRejectedValue(new Error("proveedor caído"));

    const r = await destilarDocumento(TEXTO, "inst-1");

    expect(r.destilado).toBe(false);
    expect(r.contenido.length).toBeLessThanOrEqual(MAX_CARACTERES_DOCUMENTO);
    expect(r.contenido).toContain("Politica de envios");
  });

  it("si el destilado vuelve casi vacío, tampoco se da por bueno", async () => {
    generarRespuestaMock.mockResolvedValue({ contenido: "ok" });

    expect((await destilarDocumento(TEXTO, "inst-1")).destilado).toBe(false);
  });

  it("si vuelve null, idem", async () => {
    generarRespuestaMock.mockResolvedValue({ contenido: null });

    expect((await destilarDocumento(TEXTO, "inst-1")).destilado).toBe(false);
  });
});
