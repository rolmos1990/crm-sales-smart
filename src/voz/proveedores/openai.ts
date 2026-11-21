import type { IProveedorVoz, TranscribirParams, TranscribirResult } from "./types";
import { ErrorProveedorVoz } from "./types";

const BASE_URL_POR_DEFECTO = "https://api.openai.com";
const MODELO_POR_DEFECTO = "gpt-4o-transcribe";

/**
 * 049 — Adaptador de OpenAI Speech-to-Text.
 *
 * Existe tanto por utilidad como por prueba de que el contrato no quedó
 * modelado alrededor de ElevenLabs: OpenAI devuelve otra forma —`duration` en
 * la raíz, los segmentos en `segments` en vez de `words`, y el idioma con otro
 * nombre— y aun así el dominio no se entera.
 *
 * Se usa `fetch` directo y no el SDK `openai`: la petición es un multipart
 * simple y así el adaptador no arrastra el cliente entero ni su configuración
 * global, que acá apunta a otra credencial.
 */
export function crearOpenAIVozProvider(
  apiKey: string,
  modelo?: string,
  baseUrl?: string,
): IProveedorVoz {
  const base = (baseUrl?.trim() || BASE_URL_POR_DEFECTO).replace(/\/+$/, "");
  const modeloId = modelo?.trim() || MODELO_POR_DEFECTO;

  return {
    nombre: "OPENAI",

    async transcribir(params: TranscribirParams): Promise<TranscribirResult> {
      if (!apiKey) {
        throw new ErrorProveedorVoz("Falta la credencial de OpenAI", "SIN_CREDENCIAL", false);
      }

      const inicio = Date.now();
      const abort = new AbortController();
      const temporizador = setTimeout(() => abort.abort(), params.timeoutMs);
      const cancelarExterno = () => abort.abort();
      params.signal?.addEventListener("abort", cancelarExterno, { once: true });

      try {
        const form = new FormData();
        form.append("model", modeloId);
        form.append("response_format", "verbose_json");
        form.append(
          "file",
          new Blob([new Uint8Array(params.buffer)], { type: params.mimeType }),
          params.nombreArchivo,
        );
        if (params.idioma) form.append("language", params.idioma);

        const res = await fetch(`${base}/v1/audio/transcriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: abort.signal,
        });

        if (!res.ok) throw await traducirError(res);

        const datos = (await res.json()) as RespuestaOpenAI;
        if (typeof datos?.text !== "string") {
          throw new ErrorProveedorVoz(
            "OpenAI devolvió una respuesta sin texto",
            "RESPUESTA_INVALIDA",
            true,
          );
        }

        return {
          texto: datos.text,
          idioma: datos.language ?? null,
          // OpenAI no informa confianza de idioma. `null` es deliberado: el
          // dominio ya sabe no castigar su ausencia (ver esInaudible).
          confianzaIdioma: null,
          palabras: contarPalabras(datos),
          segundos: typeof datos.duration === "number" ? Math.ceil(datos.duration) : null,
          modelo: modeloId,
          proveedor: "OPENAI",
          tiempoMs: Date.now() - inicio,
        };
      } catch (e) {
        if (e instanceof ErrorProveedorVoz) throw e;
        if (esAbort(e)) {
          throw new ErrorProveedorVoz(
            `OpenAI no respondió en ${params.timeoutMs} ms`,
            "TIMEOUT",
            true,
          );
        }
        throw new ErrorProveedorVoz("No se pudo contactar a OpenAI", "ERROR_PROVEEDOR", true);
      } finally {
        clearTimeout(temporizador);
        params.signal?.removeEventListener("abort", cancelarExterno);
      }
    },

    async estaDisponible(): Promise<boolean> {
      if (!apiKey) return false;
      try {
        const res = await fetch(`${base}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

interface RespuestaOpenAI {
  text?: string;
  language?: string;
  duration?: number;
  words?: Array<{ word?: string }>;
  segments?: Array<{ text?: string; no_speech_prob?: number }>;
}

/**
 * Conteo de elementos de habla, con la forma que devuelve OpenAI.
 *
 * Con `timestamp_granularities=word` vendría `words`; sin eso hay que
 * aproximar desde los segmentos, descartando los que el propio modelo marca
 * como "probablemente sin voz". Sin ese descarte, un audio de puro ruido
 * contaría palabras alucinadas y pasaría como transcrito.
 */
function contarPalabras(datos: RespuestaOpenAI): number {
  if (Array.isArray(datos.words)) return datos.words.length;

  if (Array.isArray(datos.segments)) {
    return datos.segments
      .filter((s) => (s?.no_speech_prob ?? 0) < 0.5)
      .reduce((n, s) => n + contarTokens(s?.text), 0);
  }

  return contarTokens(datos.text);
}

function contarTokens(texto: string | undefined): number {
  const limpio = texto?.trim();
  return limpio ? limpio.split(/\s+/).length : 0;
}

async function traducirError(res: Response): Promise<ErrorProveedorVoz> {
  const detalle = await res.text().catch(() => "");

  if (res.status === 401 || res.status === 403) {
    return new ErrorProveedorVoz("Credencial de OpenAI rechazada", "CREDENCIAL_INVALIDA", false);
  }
  if (res.status === 413) {
    return new ErrorProveedorVoz("El audio excede el tamaño admitido", "ARCHIVO_DEMASIADO_GRANDE", false);
  }
  if (res.status === 429) {
    // OpenAI usa 429 tanto para rate limit como para falta de saldo; los dos
    // se resuelven solos o con una recarga, así que reintentar tiene sentido.
    return new ErrorProveedorVoz("OpenAI limitó la petición", "LIMITE_PROVEEDOR", true);
  }
  if (res.status === 400) {
    const sinSaldo = /quota|billing|credit/i.test(detalle);
    return sinSaldo
      ? new ErrorProveedorVoz("Sin saldo en OpenAI", "LIMITE_PROVEEDOR", true)
      : new ErrorProveedorVoz("OpenAI rechazó el audio", "FORMATO_NO_SOPORTADO", false);
  }
  return new ErrorProveedorVoz(`OpenAI respondió ${res.status}`, "ERROR_PROVEEDOR", true);
}

function esAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
}
