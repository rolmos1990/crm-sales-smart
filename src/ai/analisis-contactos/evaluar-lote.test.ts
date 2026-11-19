import { describe, expect, it, vi } from "vitest";

vi.mock("@/ai/gateway/gateway", () => ({ generarRespuesta: vi.fn() }));
vi.mock("./contexto", () => ({ cargarConversacionesParaIA: vi.fn(), construirContextoContacto: vi.fn(), textosFuente: vi.fn() }));

const { calcularMaxTokensSalida } = await import("./evaluar-lote");

describe("calcularMaxTokensSalida", () => {
  it("un lote de un solo contacto tiene margen para la respuesta completa (antes quedaba en 750 y se cortaba)", () => {
    expect(calcularMaxTokensSalida(1)).toBeGreaterThanOrEqual(1200);
  });

  it("crece con el tamaño del lote", () => {
    expect(calcularMaxTokensSalida(10)).toBeGreaterThan(calcularMaxTokensSalida(5));
  });

  it("no pasa del máximo que aceptan los proveedores", () => {
    expect(calcularMaxTokensSalida(50)).toBe(8000);
  });
});
