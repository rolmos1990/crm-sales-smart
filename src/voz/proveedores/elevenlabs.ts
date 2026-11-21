import type { IProveedorVoz, TranscribirParams, TranscribirResult } from "./types";
import { ErrorProveedorVoz } from "./types";

const BASE_URL_POR_DEFECTO = "https://api.elevenlabs.io";
const MODELO_POR_DEFECTO = "scribe_v3";

/**
 * 049 — Adaptador de ElevenLabs Speech-to-Text (Scribe).
 *
 * Modo SÍNCRONO, sin `webhook: true`. El perfil real de los audios lo
 * permite: medidos sobre los 730 existentes, promedio 12,8 s, p90 26,1 s y
 * máximo 66,3 s. El modo asíncrono exigiría exponer un endpoint público,
 * verificar su firma y tolerar entregas duplicadas y fuera de orden, para
 * cero beneficio a esta escala.
 *
 * Se manda el BUFFER, no `source_url`: pasar la URL obligaría a que el proxy
 * /cdn sea alcanzable públicamente desde ElevenLabs, y ese proxy sirve el
 * objeto sin autenticación.
 *
 * `fetch`, `FormData` y `Blob` son globales en Node 20: sin dependencia nueva.
 */
export function crearElevenLabsProvider(
  apiKey: string,
  modelo?: string,
  baseUrl?: string,
): IProveedorVoz {
  const base = (baseUrl?.trim() || BASE_URL_POR_DEFECTO).replace(/\/+$/, "");
  const modeloId = modelo?.trim() || MODELO_POR_DEFECTO;

  return {
    nombre: "ELEVENLABS",

    async transcribir(params: TranscribirParams): Promise<TranscribirResult> {
      if (!apiKey) {
        throw new ErrorProveedorVoz("Falta la credencial de ElevenLabs", "SIN_CREDENCIAL", false);
      }

      const inicio = Date.now();
      const abort = new AbortController();
      const temporizador = setTimeout(() => abort.abort(), params.timeoutMs);
      // El AbortSignal del llamador y el del timeout tienen que cortar los dos.
      const cancelarExterno = () => abort.abort();
      params.signal?.addEventListener("abort", cancelarExterno, { once: true });

      try {
        const form = new FormData();
        form.append("model_id", modeloId);
        form.append(
          "file",
          new Blob([new Uint8Array(params.buffer)], { type: params.mimeType }),
          params.nombreArchivo,
        );
        if (params.idioma) form.append("language_code", params.idioma);

        const res = await fetch(`${base}/v1/speech-to-text`, {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: form,
          signal: abort.signal,
        });

        if (!res.ok) throw await traducirError(res);

        const datos = (await res.json()) as RespuestaScribe;
        if (typeof datos?.text !== "string") {
          throw new ErrorProveedorVoz(
            "ElevenLabs devolvió una respuesta sin texto",
            "RESPUESTA_INVALIDA",
            true,
          );
        }

        return {
          texto: datos.text,
          idioma: datos.language_code ?? null,
          confianzaIdioma:
            typeof datos.language_probability === "number" ? datos.language_probability : null,
          palabras: contarPalabras(datos.words),
          segundos: calcularSegundos(datos.words),
          modelo: modeloId,
          proveedor: "ELEVENLABS",
          tiempoMs: Date.now() - inicio,
        };
      } catch (e) {
        if (e instanceof ErrorProveedorVoz) throw e;
        if (esAbort(e)) {
          throw new ErrorProveedorVoz(
            `ElevenLabs no respondió en ${params.timeoutMs} ms`,
            "TIMEOUT",
            true,
          );
        }
        throw new ErrorProveedorVoz(
          "No se pudo contactar a ElevenLabs",
          "ERROR_PROVEEDOR",
          true,
        );
      } finally {
        clearTimeout(temporizador);
        params.signal?.removeEventListener("abort", cancelarExterno);
      }
    },

    async estaDisponible(): Promise<boolean> {
      if (!apiKey) return false;
      try {
        const res = await fetch(`${base}/v1/user`, {
          headers: { "xi-api-key": apiKey },
          signal: AbortSignal.timeout(10_000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

interface PalabraScribe {
  text?: string;
  /** "word" | "spacing" | "audio_event" */
  type?: string;
  start?: number;
  end?: number;
}

interface RespuestaScribe {
  text?: string;
  language_code?: string;
  language_probability?: number;
  words?: PalabraScribe[];
}

/**
 * Solo los elementos de HABLA. Un audio de música o ruido devuelve `words`
 * lleno de `audio_event` y texto no vacío; contar `words.length` lo daría por
 * transcrito y el agente leería una descripción de ruido como si el cliente
 * hubiera dicho algo.
 */
function contarPalabras(words: PalabraScribe[] | undefined): number {
  if (!Array.isArray(words)) return 0;
  return words.filter((w) => w?.type === "word").length;
}

function calcularSegundos(words: PalabraScribe[] | undefined): number | null {
  if (!Array.isArray(words) || words.length === 0) return null;
  let fin = 0;
  for (const w of words) if (typeof w?.end === "number" && w.end > fin) fin = w.end;
  return fin > 0 ? Math.ceil(fin) : null;
}

async function traducirError(res: Response): Promise<ErrorProveedorVoz> {
  // El detalle del cuerpo se usa para clasificar, nunca se propaga al cliente.
  const detalle = await res.text().catch(() => "");

  if (res.status === 401 || res.status === 403) {
    // ElevenLabs devuelve 403 tanto para una key inválida como para una key
    // VÁLIDA con restricción de IP. Decirle "credencial rechazada" al que
    // configuró manda a rotar una key que está perfecta, y el problema real
    // —la IP del servidor no está en la lista— no se arregla nunca.
    if (/ip_not_allowed|IP address/i.test(detalle)) {
      return new ErrorProveedorVoz(
        "La API key de ElevenLabs tiene restricción por IP y la IP de este servidor no está permitida",
        "IP_NO_PERMITIDA",
        false,
      );
    }
    return new ErrorProveedorVoz("Credencial de ElevenLabs rechazada", "CREDENCIAL_INVALIDA", false);
  }
  if (res.status === 413) {
    return new ErrorProveedorVoz("El audio excede el tamaño admitido", "ARCHIVO_DEMASIADO_GRANDE", false);
  }
  if (res.status === 422 || res.status === 400) {
    // 422 con "quota"/"credit" es falta de saldo, no un archivo malo: eso sí
    // se resuelve solo cuando el comercio recarga, así que es reintentable.
    const sinSaldo = /quota|credit|balance/i.test(detalle);
    return sinSaldo
      ? new ErrorProveedorVoz("Sin saldo en ElevenLabs", "LIMITE_PROVEEDOR", true)
      : new ErrorProveedorVoz("ElevenLabs rechazó el audio", "FORMATO_NO_SOPORTADO", false);
  }
  if (res.status === 429) {
    return new ErrorProveedorVoz("ElevenLabs limitó la tasa de peticiones", "LIMITE_PROVEEDOR", true);
  }
  return new ErrorProveedorVoz(`ElevenLabs respondió ${res.status}`, "ERROR_PROVEEDOR", true);
}

function esAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
}
