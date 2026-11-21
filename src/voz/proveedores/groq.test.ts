import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { crearGroqVozProvider } from "./groq";
import { ErrorProveedorVoz } from "./types";

/**
 * 050 — Groq habla el dialecto de OpenAI, así que lo que se verifica acá es
 * justo lo que NO comparten: el host (con su segmento /openai, que si se
 * pierde da 404 en cada audio) y la traducción de errores, que decide si la
 * cola reintenta o descarta.
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

describe("adaptador Groq — petición", () => {
  it("pega al host de Groq bajo /openai y con el turbo por defecto", async () => {
    fetchMock.mockResolvedValue(respuesta({ text: "hola", duration: 3 }));

    await crearGroqVozProvider("gsk-abc").transcribir(params);

    const [url, init] = fetchMock.mock.calls[0];
    // Sin el segmento /openai el host responde 404 y ningún audio se transcribe.
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(init.headers).toEqual({ Authorization: "Bearer gsk-abc" });

    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect(form.get("response_format")).toBe("verbose_json");
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("respeta el modelo y la URL base configurados por la cuenta", async () => {
    fetchMock.mockResolvedValue(respuesta({ text: "hola" }));

    await crearGroqVozProvider("k", "whisper-large-v3", "https://proxy.interno/openai/").transcribir(
      params,
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://proxy.interno/openai/v1/audio/transcriptions");
    expect((init.body as FormData).get("model")).toBe("whisper-large-v3");
  });

  it("sin credencial falla sin llegar a gastar una llamada", async () => {
    const e = await crearGroqVozProvider("").transcribir(params).catch((x) => x);

    expect(e).toBeInstanceOf(ErrorProveedorVoz);
    expect(e.codigo).toBe("SIN_CREDENCIAL");
    expect(e.reintentable).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("adaptador Groq — mapeo al contrato común", () => {
  it("traduce duration y language, y deja la confianza en null", async () => {
    fetchMock.mockResolvedValue(
      respuesta({ text: "hola mundo", language: "spanish", duration: 12.3 }),
    );

    const r = await crearGroqVozProvider("k").transcribir(params);

    expect(r.segundos).toBe(13); // ceil
    expect(r.idioma).toBe("spanish");
    expect(r.confianzaIdioma).toBeNull();
    expect(r.proveedor).toBe("GROQ");
    expect(r.modelo).toBe("whisper-large-v3-turbo");
  });

  it("descarta los segmentos que el modelo marca como sin voz", async () => {
    // Whisper alucina palabras sobre silencio; sin este descarte un audio de
    // puro ruido pasaría como transcrito en vez de quedar INAUDIBLE.
    fetchMock.mockResolvedValue(
      respuesta({
        text: "Subtítulos realizados por la comunidad de Amara.org",
        segments: [
          { text: "Subtítulos realizados por la comunidad", no_speech_prob: 0.91 },
          { text: "de Amara.org", no_speech_prob: 0.87 },
        ],
      }),
    );

    const r = await crearGroqVozProvider("k").transcribir(params);

    expect(r.palabras).toBe(0);
  });

  it("una respuesta sin texto es reintentable, no un silencio", async () => {
    fetchMock.mockResolvedValue(respuesta({ duration: 4 }));

    const e = await crearGroqVozProvider("k").transcribir(params).catch((x) => x);

    expect(e.codigo).toBe("RESPUESTA_INVALIDA");
    expect(e.reintentable).toBe(true);
  });
});

describe("adaptador Groq — errores traducidos al mismo vocabulario", () => {
  it.each([
    [401, "CREDENCIAL_INVALIDA", false],
    [403, "CREDENCIAL_INVALIDA", false],
    [413, "ARCHIVO_DEMASIADO_GRANDE", false],
    [429, "LIMITE_PROVEEDOR", true],
    [500, "ERROR_PROVEEDOR", true],
    [503, "ERROR_PROVEEDOR", true],
  ])("HTTP %i ⇒ %s (reintentable: %s)", async (status, codigo, reintentable) => {
    fetchMock.mockResolvedValue(respuesta({ error: { message: "x" } }, { status }));

    const e = await crearGroqVozProvider("k").transcribir(params).catch((x) => x);

    expect(e).toBeInstanceOf(ErrorProveedorVoz);
    expect(e.codigo).toBe(codigo);
    expect(e.reintentable).toBe(reintentable);
  });

  it("el 429 de Groq es cuota, nunca falta de saldo: se reintenta", async () => {
    // Es la diferencia con OpenAI, que manda la falta de saldo por 400. Si
    // esto se tradujera a permanente, el tier gratuito dejaría de transcribir
    // hasta que alguien lo mirara a mano, en vez de reponerse solo.
    fetchMock.mockResolvedValue(
      respuesta({ error: { message: "rate limit exceeded" } }, { status: 429 }),
    );

    const e = await crearGroqVozProvider("k").transcribir(params).catch((x) => x);

    expect(e.reintentable).toBe(true);
  });

  it("400 es permanente, y distingue audio de modelo en el mensaje", async () => {
    fetchMock.mockResolvedValue(
      respuesta({ error: { message: "model whisper-x decommissioned" } }, { status: 400 }),
    );
    const porModelo = await crearGroqVozProvider("k").transcribir(params).catch((x) => x);
    expect(porModelo.codigo).toBe("FORMATO_NO_SOPORTADO");
    expect(porModelo.reintentable).toBe(false);
    expect(porModelo.message).toMatch(/modelo/i);

    fetchMock.mockResolvedValue(
      respuesta({ error: { message: "could not decode audio" } }, { status: 400 }),
    );
    const porAudio = await crearGroqVozProvider("k").transcribir(params).catch((x) => x);
    expect(porAudio.message).toMatch(/audio/i);
  });
});

describe("adaptador Groq — verificación de credencial", () => {
  it("consulta los modelos del host de Groq", async () => {
    fetchMock.mockResolvedValue(respuesta({ data: [] }));

    await expect(crearGroqVozProvider("gsk-ok").estaDisponible()).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/models");
  });

  it("sin credencial no consulta nada y responde que no está disponible", async () => {
    await expect(crearGroqVozProvider("").estaDisponible()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
