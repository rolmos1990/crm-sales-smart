import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { crearElevenLabsProvider } from "./elevenlabs";
import { ErrorProveedorVoz } from "./types";

/**
 * Se asertan los PARÁMETROS ENVIADOS al proveedor, no la respuesta: lo que
 * puede romperse en silencio es mandar el modelo equivocado o el header mal.
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

describe("adaptador ElevenLabs — petición", () => {
  it("manda model_id, el header xi-api-key y el archivo en multipart", async () => {
    fetchMock.mockResolvedValue(respuesta({ text: "hola", words: [{ type: "word", end: 1 }] }));

    await crearElevenLabsProvider("k-secreta").transcribir(params);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "xi-api-key": "k-secreta" });

    const form = init.body as FormData;
    expect(form.get("model_id")).toBe("scribe_v3");
    expect(form.get("file")).toBeInstanceOf(Blob);
    // Sin webhook: el modo es síncrono (research R4).
    expect(form.get("webhook")).toBeNull();
    expect(form.get("source_url")).toBeNull();
  });

  it("respeta el modelo y la baseUrl configurados — baseUrl SÍ llega al adaptador", async () => {
    fetchMock.mockResolvedValue(respuesta({ text: "x", words: [{ type: "word", end: 1 }] }));

    await crearElevenLabsProvider("k", "scribe_v2", "https://api.eu.elevenlabs.io/").transcribir(params);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.eu.elevenlabs.io/v1/speech-to-text");
    expect((init.body as FormData).get("model_id")).toBe("scribe_v2");
  });

  it("no manda language_code si no se pide idioma (autodetección)", async () => {
    fetchMock.mockResolvedValue(respuesta({ text: "x", words: [{ type: "word", end: 1 }] }));

    await crearElevenLabsProvider("k").transcribir(params);

    expect((fetchMock.mock.calls[0][1].body as FormData).get("language_code")).toBeNull();
  });
});

describe("adaptador ElevenLabs — respuesta", () => {
  it("cuenta solo los elementos de tipo word, no los audio_event ni el espaciado", async () => {
    fetchMock.mockResolvedValue(
      respuesta({
        text: "hola mundo",
        language_code: "spa",
        language_probability: 0.97,
        words: [
          { text: "hola", type: "word", end: 0.4 },
          { text: " ", type: "spacing", end: 0.5 },
          { text: "mundo", type: "word", end: 1.2 },
          { text: "(música)", type: "audio_event", end: 3.8 },
        ],
      }),
    );

    const r = await crearElevenLabsProvider("k").transcribir(params);

    expect(r.palabras).toBe(2);
    expect(r.idioma).toBe("spa");
    expect(r.confianzaIdioma).toBe(0.97);
    expect(r.segundos).toBe(4); // ceil del end máximo
    expect(r.modelo).toBe("scribe_v3");
  });

  it("un audio de pura música devuelve 0 palabras aunque traiga texto", async () => {
    fetchMock.mockResolvedValue(
      respuesta({ text: "(música de fondo)", words: [{ type: "audio_event", end: 5 }] }),
    );

    const r = await crearElevenLabsProvider("k").transcribir(params);

    expect(r.palabras).toBe(0);
  });
});

describe("adaptador ElevenLabs — errores traducidos", () => {
  it.each([
    [401, "CREDENCIAL_INVALIDA", false],
    [403, "CREDENCIAL_INVALIDA", false],
    [413, "ARCHIVO_DEMASIADO_GRANDE", false],
    [429, "LIMITE_PROVEEDOR", true],
    [500, "ERROR_PROVEEDOR", true],
  ])("HTTP %i ⇒ %s (reintentable: %s)", async (status, codigo, reintentable) => {
    fetchMock.mockResolvedValue(respuesta({ detail: "nope" }, { status }));

    const e = await crearElevenLabsProvider("k").transcribir(params).catch((x) => x);

    expect(e).toBeInstanceOf(ErrorProveedorVoz);
    expect(e.codigo).toBe(codigo);
    expect(e.reintentable).toBe(reintentable);
  });

  it("422 por falta de saldo es REINTENTABLE; 422 por formato no lo es", async () => {
    fetchMock.mockResolvedValue(respuesta({ detail: "insufficient quota" }, { status: 422 }));
    const sinSaldo = await crearElevenLabsProvider("k").transcribir(params).catch((x) => x);
    expect(sinSaldo.codigo).toBe("LIMITE_PROVEEDOR");
    expect(sinSaldo.reintentable).toBe(true);

    fetchMock.mockResolvedValue(respuesta({ detail: "invalid file" }, { status: 422 }));
    const formato = await crearElevenLabsProvider("k").transcribir(params).catch((x) => x);
    expect(formato.codigo).toBe("FORMATO_NO_SOPORTADO");
    expect(formato.reintentable).toBe(false);
  });

  it("sin credencial no llega a hacer la petición", async () => {
    const e = await crearElevenLabsProvider("").transcribir(params).catch((x) => x);

    expect(e.codigo).toBe("SIN_CREDENCIAL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un abort se traduce a TIMEOUT reintentable", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("abortada"), { name: "AbortError" }));

    const e = await crearElevenLabsProvider("k").transcribir(params).catch((x) => x);

    expect(e.codigo).toBe("TIMEOUT");
    expect(e.reintentable).toBe(true);
  });

  it("una respuesta sin campo text es inválida, no un texto vacío", async () => {
    fetchMock.mockResolvedValue(respuesta({ language_code: "spa" }));

    const e = await crearElevenLabsProvider("k").transcribir(params).catch((x) => x);

    expect(e.codigo).toBe("RESPUESTA_INVALIDA");
  });
});

describe("estaDisponible", () => {
  it("true con 2xx de /v1/user", async () => {
    fetchMock.mockResolvedValue(respuesta({ subscription: {} }));
    await expect(crearElevenLabsProvider("k").estaDisponible()).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.elevenlabs.io/v1/user");
  });

  it("false sin credencial, sin hacer la petición", async () => {
    await expect(crearElevenLabsProvider("").estaDisponible()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("false si la red falla, sin propagar el error", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(crearElevenLabsProvider("k").estaDisponible()).resolves.toBe(false);
  });
});
