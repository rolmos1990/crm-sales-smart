import { describe, expect, it, vi, beforeEach } from "vitest";

const createMock = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: (...a: unknown[]) => createMock(...a) } };
    models = { list: () => Promise.resolve({}) };
  },
}));

const { crearOpenAIProvider } = await import("./openai");

const parametros = () => createMock.mock.calls[0][0] as Record<string, unknown>;

/** ChatParams pide `modelo` y `tarea` siempre; acá no son lo que se prueba. */
const chat = (extra: Record<string, unknown> = {}) => ({
  mensajes: [{ rol: "user" as const, contenido: "hola" }],
  modelo: "",
  tarea: "CHAT" as const,
  ...extra,
});

const herramienta = (name = "buscar") => ({
  name,
  description: "d",
  input_schema: { type: "object" as const, properties: {} },
});

const RESPUESTA_TEXTO = {
  choices: [{ finish_reason: "stop", message: { content: "Hola", tool_calls: null } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
};

beforeEach(() => {
  createMock.mockReset().mockResolvedValue(RESPUESTA_TEXTO);
});

// Las tres diferencias con DeepSeek que, copiadas sin mirar, dejaban al
// agente sin responder una sola vez.
describe("OpenAIProvider — parámetros compatibles con los modelos actuales", () => {
  it("NUNCA manda temperature: los modelos de razonamiento la rechazan con un 400", async () => {
    await crearOpenAIProvider("sk-x").chat(chat({ temperatura: 0.7 }));

    expect(parametros()).not.toHaveProperty("temperature");
  });

  it("usa max_completion_tokens, no el max_tokens deprecado", async () => {
    await crearOpenAIProvider("sk-x").chat(chat({ maxTokens: 500 }));

    expect(parametros().max_completion_tokens).toBe(500);
    expect(parametros()).not.toHaveProperty("max_tokens");
  });

  it("tampoco manda temperature en el camino de herramientas, que es el que más se usa", async () => {
    await crearOpenAIProvider("sk-x").chatConHerramientas({
      ...chat({ temperatura: 0.7 }),
      herramientas: [herramienta()],
    });

    expect(parametros()).not.toHaveProperty("temperature");
    expect(parametros().max_completion_tokens).toBe(2048);
  });

  it("no fija baseURL: usa la de OpenAI, a diferencia de DeepSeek y NVIDIA", async () => {
    // Si alguien copiara un baseURL de otro proveedor, las llamadas se irían
    // al servidor equivocado con la key de OpenAI.
    const fuente = await import("node:fs").then((fs) => fs.readFileSync("src/ai/proveedores/openai.ts", "utf8"));

    expect(fuente).not.toMatch(/baseURL:\s*["']http/);
  });
});

describe("OpenAIProvider — resultados", () => {
  it("se identifica como OPENAI, no como el proveedor del que se copió la forma", async () => {
    const r = await crearOpenAIProvider("sk-x").chat(chat());

    expect(r.proveedor).toBe("OPENAI");
    expect(r.contenido).toBe("Hola");
    expect(r.tokensInput).toBe(10);
    expect(r.tokensOutput).toBe(5);
  });

  it("traduce los tool_calls al formato interno de bloques", async () => {
    createMock.mockResolvedValue({
      choices: [{
        finish_reason: "tool_calls",
        message: {
          content: null,
          tool_calls: [{ id: "call-1", type: "function", function: { name: "buscar_productos", arguments: '{"query":"luna"}' } }],
        },
      }],
      usage: { prompt_tokens: 20, completion_tokens: 8 },
    });

    const r = await crearOpenAIProvider("sk-x").chatConHerramientas({
      ...chat(),
      herramientas: [herramienta("buscar_productos")],
    });

    expect(r.tipo).toBe("herramienta");
    if (r.tipo === "herramienta") {
      expect(r.herramientasLlamadas).toEqual([
        { type: "tool_use", id: "call-1", name: "buscar_productos", input: { query: "luna" } },
      ]);
    }
  });

  it("forzarTexto corta el tool calling", async () => {
    await crearOpenAIProvider("sk-x").chatConHerramientas({
      ...chat(),
      herramientas: [herramienta("x")],
      forzarTexto: true,
    });

    expect(parametros().tool_choice).toBe("none");
  });

  it("el modelo por defecto se puede sobreescribir al construirlo", async () => {
    await crearOpenAIProvider("sk-x", "gpt-6-luna").chat(chat());

    expect(parametros().model).toBe("gpt-6-luna");
  });
});
