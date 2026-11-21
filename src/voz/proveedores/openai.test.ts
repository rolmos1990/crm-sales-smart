import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { crearOpenAIVozProvider } from "./openai";
import { ErrorProveedorVoz } from "./types";

/**
 * Este adaptador existe sobre todo como prueba de que el contrato no quedó
 * modelado alrededor de ElevenLabs: OpenAI devuelve otra forma de respuesta y
 * el dominio no se entera.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function respuesta(body: unknown, init: { status?: number } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const params = {
  buffer: Buffer.from("fake-audio"),
  mimeType: "audio/ogg; codecs=opus",
  nombreArchivo: "audio-123",
  timeoutMs: 12_000,
};

describe("adaptador OpenAI — petición", () => {
  it("usa Bearer y pide verbose_json para obtener duración y segmentos", async () => {
    fetchMock.mockResolvedValue(respuesta({ text: "hola", duration: 3 }));

    await crearOpenAIVozProvider("sk-abc").transcribir(params);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init.headers).toEqual({ Authorization: "Bearer sk-abc" });

    const form = init.body as FormData;
    expect(form.get("model")).toBe("gpt-4o-transcribe");
    expect(form.get("response_format")).toBe("verbose_json");
    expect(form.get("file")).toBeInstanceOf(Blob);
  });
});

describe("adaptador OpenAI — mapeo al contrato común", () => {
  it("traduce duration y language, y deja la confianza en null", async () => {
    fetchMock.mockResolvedValue(
      respuesta({ text: "hola mundo", language: "spanish", duration: 12.3 }),
    );

    const r = await crearOpenAIVozProvider("k").transcribir(params);

    expect(r.segundos).toBe(13); // ceil
    expect(r.idioma).toBe("spanish");
    // OpenAI no informa confianza; null es deliberado y el dominio no lo
    // castiga (esInaudible solo mira el umbral si hay dato).
    expect(r.confianzaIdioma).toBeNull();
    expect(r.proveedor).toBe("OPENAI");
  });

  it("cuenta palabras desde `words` cuando vienen", async () => {
    fetchMock.mockResolvedValue(
      respuesta({ text: "hola mundo", words: [{ word: "hola" }, { word: "mundo" }] }),
    );

    const r = await crearOpenAIVozProvider("k").transcribir(params);

    expect(r.palabras).toBe(2);
  });

  it("descarta los segmentos que el modelo marca como sin voz", async () => {
    // Sin este descarte, un audio de puro ruido contaría palabras alucinadas
    // y pasaría como transcrito en vez de quedar INAUDIBLE.
    fetchMock.mockResolvedValue(
      respuesta({
        text: "música de fondo ambiente",
        segments: [
          { text: "música de fondo", no_speech_prob: 0.92 },
          { text: "ambiente", no_speech_prob: 0.88 },
        ],
      }),
    );

    const r = await crearOpenAIVozProvider("k").transcribir(params);

    expect(r.palabras).toBe(0);
  });

  it("cuenta los segmentos que sí son voz", async () => {
    fetchMock.mockResolvedValue(
      respuesta({
        text: "quiero el combo",
        segments: [{ text: "quiero el combo", no_speech_prob: 0.02 }],
      }),
    );

    const r = await crearOpenAIVozProvider("k").transcribir(params);

    expect(r.palabras).toBe(3);
  });
});

describe("adaptador OpenAI — errores traducidos al mismo vocabulario", () => {
  it.each([
    [401, "CREDENCIAL_INVALIDA", false],
    [429, "LIMITE_PROVEEDOR", true],
    [500, "ERROR_PROVEEDOR", true],
  ])("HTTP %i ⇒ %s (reintentable: %s)", async (status, codigo, reintentable) => {
    fetchMock.mockResolvedValue(respuesta({ error: "x" }, { status }));

    const e = await crearOpenAIVozProvider("k").transcribir(params).catch((x) => x);

    expect(e).toBeInstanceOf(ErrorProveedorVoz);
    expect(e.codigo).toBe(codigo);
    expect(e.reintentable).toBe(reintentable);
  });

  it("400 por saldo es reintentable; 400 por formato no", async () => {
    fetchMock.mockResolvedValue(respuesta({ error: "billing hard limit" }, { status: 400 }));
    await expect(
      crearOpenAIVozProvider("k").transcribir(params).catch((x) => x.codigo),
    ).resolves.toBe("LIMITE_PROVEEDOR");

    fetchMock.mockResolvedValue(respuesta({ error: "invalid audio" }, { status: 400 }));
    await expect(
      crearOpenAIVozProvider("k").transcribir(params).catch((x) => x.codigo),
    ).resolves.toBe("FORMATO_NO_SOPORTADO");
  });
});
