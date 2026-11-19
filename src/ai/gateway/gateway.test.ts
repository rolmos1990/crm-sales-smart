import { beforeEach, describe, expect, it, vi } from "vitest";

// 042 — Extensiones aditivas del gateway: modo JSON, datos de la atención y
// consumo registrado aunque el proveedor falle (FR-040).

const chatMock = vi.fn();
const registrarUsoIA = vi.fn(async (..._a: unknown[]) => "uso-1");

vi.mock("@/ai/orquestador/orquestador", () => ({
  seleccionarProveedor: vi.fn(async () => ({
    proveedor: { nombre: "DEEPSEEK", chat: (...a: unknown[]) => chatMock(...a) },
    proveedorId: "prov-1",
    costoInputPorMil: 0.001,
    costoOutputPorMil: 0.002,
    modeloDefault: "deepseek-chat",
  })),
  registrarFalla: vi.fn(),
  registrarExito: vi.fn(),
}));
vi.mock("@/ai/auditoria/logger", async (original) => {
  const real = await original<typeof import("@/ai/auditoria/logger")>();
  return { ...real, registrarUsoIA: (...a: unknown[]) => registrarUsoIA(...a) };
});
vi.mock("@/ai/queries", () => ({
  obtenerConfiguracionIA: vi.fn(async () => ({ habilitado: true, modeloDefault: "x", temperaturaDefault: 0.7 })),
  obtenerAgenteIAConfig: vi.fn(async () => null),
  obtenerVersionPublicadaVigenteId: vi.fn(async () => null),
}));

const { generarRespuesta } = await import("./gateway");

const solicitud = (extra: Record<string, unknown> = {}) => ({
  instanciaId: "ckinstancia000000000000000",
  tarea: "ANALISIS_CONTACTOS" as const,
  mensajes: [{ rol: "user" as const, contenido: "hola" }],
  ...extra,
});

beforeEach(() => {
  chatMock.mockReset();
  registrarUsoIA.mockClear();
});

describe("generarRespuesta (042)", () => {
  it("propaga formatoRespuesta al proveedor y devuelve los datos para la atención", async () => {
    chatMock.mockResolvedValue({ contenido: "{}", tokensInput: 1000, tokensOutput: 500, tokensCacheados: 200, modelo: "deepseek-chat", proveedor: "DEEPSEEK", tiempoMs: 10 });
    const r = await generarRespuesta(solicitud({ formatoRespuesta: "json" }));

    expect(chatMock.mock.calls[0][0]).toMatchObject({ formatoRespuesta: "json", tarea: "ANALISIS_CONTACTOS" });
    expect(r).toMatchObject({ proveedorIAId: "prov-1", tokensCacheados: 200, usoIAId: "uso-1" });
    expect(r.costoEstimado).toBeCloseTo(0.002);
  });

  it("sin formatoRespuesta no se manda el campo con valor", async () => {
    chatMock.mockResolvedValue({ contenido: "x", tokensInput: 1, tokensOutput: 1, modelo: "m", proveedor: "DEEPSEEK", tiempoMs: 1 });
    await generarRespuesta(solicitud({ tarea: "CHAT" }));
    expect(chatMock.mock.calls[0][0].formatoRespuesta).toBeUndefined();
  });

  it("si el error trae usage, registra esos tokens y su costo (FR-040)", async () => {
    chatMock.mockRejectedValue(Object.assign(new Error("respuesta cortada"), { usage: { prompt_tokens: 800, completion_tokens: 50 } }));
    await expect(generarRespuesta(solicitud())).rejects.toThrow("respuesta cortada");

    const registro = registrarUsoIA.mock.calls[0][0] as { exito: boolean; resultado: { tokensInput: number; tokensOutput: number }; costoEstimado?: number };
    expect(registro.exito).toBe(false);
    expect(registro.resultado).toMatchObject({ tokensInput: 800, tokensOutput: 50 });
    expect(registro.costoEstimado).toBeCloseTo(0.0009);
  });

  it("sin usage en el error registra 0, como siempre", async () => {
    chatMock.mockRejectedValue(new Error("timeout"));
    await expect(generarRespuesta(solicitud())).rejects.toThrow();
    const registro = registrarUsoIA.mock.calls[0][0] as { resultado: { tokensInput: number } };
    expect(registro.resultado.tokensInput).toBe(0);
  });
});
