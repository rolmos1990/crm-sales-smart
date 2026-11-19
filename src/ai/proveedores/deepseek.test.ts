import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: (...a: unknown[]) => createMock(...a) } };
  },
}));

const { DeepSeekProvider } = await import("./deepseek");

const parametros = () => createMock.mock.calls[0][0] as Record<string, unknown>;
const chat = (extra: Record<string, unknown> = {}) => ({
  mensajes: [{ rol: "user" as const, contenido: "hola" }],
  modelo: "deepseek-v4-flash",
  tarea: "CHAT" as const,
  ...extra,
});

beforeEach(() => {
  createMock.mockReset().mockResolvedValue({
    choices: [{ finish_reason: "stop", message: { content: "{}" } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });
});

describe("DeepSeekProvider — salida estructurada (042)", () => {
  it("con formato JSON apaga el razonamiento: si no, se come el max_tokens y el JSON llega cortado", async () => {
    await new DeepSeekProvider("sk-x").chat(chat({ formatoRespuesta: "json" }));

    expect(parametros()).toMatchObject({ response_format: { type: "json_object" }, thinking: { type: "disabled" } });
  });

  it("sin formato JSON el pedido queda como siempre (el agente conserva su comportamiento)", async () => {
    await new DeepSeekProvider("sk-x").chat(chat());

    expect(parametros()).not.toHaveProperty("thinking");
    expect(parametros()).not.toHaveProperty("response_format");
  });
});
