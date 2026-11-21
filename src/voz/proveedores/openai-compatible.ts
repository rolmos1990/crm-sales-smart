import type { ProveedorVozEnum } from "@/generated/prisma/enums";
import type { IProveedorVoz, TranscribirParams, TranscribirResult } from "./types";
import { ErrorProveedorVoz } from "./types";

/**
 * 050 — Transporte común de los servicios que hablan el dialecto
 * `/v1/audio/transcriptions` de OpenAI.
 *
 * Lo usan OpenAI y Groq. No es una abstracción preventiva: Groq expone
 * literalmente la API de OpenAI bajo otro host, así que duplicar el multipart,
 * el doble corte por AbortSignal y el conteo de palabras habría dejado dos
 * copias que se arreglan por separado — y el que no se arregle transcribe mal
 * sin fallar.
 *
 * Lo que NO es común y por eso queda en cada adaptador: la URL base, el modelo
 * por defecto y la traducción de los códigos HTTP. Esa última es justo donde
 * los dos servicios se separan (OpenAI usa 400 para falta de saldo; Groq no),
 * y colapsarla haría que un fallo permanente de uno se reintentara cinco veces
 * en el otro.
 *
 * ElevenLabs tiene su propio archivo entero: otra forma de petición y de
 * respuesta, nada que compartir.
 */
export interface OpcionesCompatibleOpenAI {
  nombre: ProveedorVozEnum;
  /** Cómo se nombra el servicio en un mensaje que lee una persona. */
  etiqueta: string;
  apiKey: string;
  modelo?: string;
  baseUrl?: string;
  baseUrlPorDefecto: string;
  modeloPorDefecto: string;
  /** El cuerpo ya viene leído: la respuesta solo se puede consumir una vez. */
  traducirError: (status: number, detalle: string) => ErrorProveedorVoz;
}

export function crearProveedorCompatibleOpenAI(op: OpcionesCompatibleOpenAI): IProveedorVoz {
  const base = (op.baseUrl?.trim() || op.baseUrlPorDefecto).replace(/\/+$/, "");
  const modeloId = op.modelo?.trim() || op.modeloPorDefecto;

  return {
    nombre: op.nombre,

    async transcribir(params: TranscribirParams): Promise<TranscribirResult> {
      if (!op.apiKey) {
        throw new ErrorProveedorVoz(
          `Falta la credencial de ${op.etiqueta}`,
          "SIN_CREDENCIAL",
          false,
        );
      }

      const inicio = Date.now();
      const abort = new AbortController();
      const temporizador = setTimeout(() => abort.abort(), params.timeoutMs);
      // El AbortSignal del llamador y el del timeout tienen que cortar los dos.
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
          headers: { Authorization: `Bearer ${op.apiKey}` },
          body: form,
          signal: abort.signal,
        });

        if (!res.ok) {
          const detalle = await res.text().catch(() => "");
          throw op.traducirError(res.status, detalle);
        }

        const datos = (await res.json()) as RespuestaCompatibleOpenAI;
        if (typeof datos?.text !== "string") {
          throw new ErrorProveedorVoz(
            `${op.etiqueta} devolvió una respuesta sin texto`,
            "RESPUESTA_INVALIDA",
            true,
          );
        }

        return {
          texto: datos.text,
          idioma: datos.language ?? null,
          // Ninguno de los dos informa confianza de idioma. `null` es
          // deliberado: el dominio ya sabe no castigar su ausencia (ver
          // esInaudible).
          confianzaIdioma: null,
          palabras: contarPalabras(datos),
          segundos: typeof datos.duration === "number" ? Math.ceil(datos.duration) : null,
          modelo: modeloId,
          proveedor: op.nombre,
          tiempoMs: Date.now() - inicio,
        };
      } catch (e) {
        if (e instanceof ErrorProveedorVoz) throw e;
        if (esAbort(e)) {
          throw new ErrorProveedorVoz(
            `${op.etiqueta} no respondió en ${params.timeoutMs} ms`,
            "TIMEOUT",
            true,
          );
        }
        throw new ErrorProveedorVoz(
          `No se pudo contactar a ${op.etiqueta}`,
          "ERROR_PROVEEDOR",
          true,
        );
      } finally {
        clearTimeout(temporizador);
        params.signal?.removeEventListener("abort", cancelarExterno);
      }
    },

    async estaDisponible(): Promise<boolean> {
      if (!op.apiKey) return false;
      try {
        const res = await fetch(`${base}/v1/models`, {
          headers: { Authorization: `Bearer ${op.apiKey}` },
          signal: AbortSignal.timeout(10_000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

export interface RespuestaCompatibleOpenAI {
  text?: string;
  language?: string;
  duration?: number;
  words?: Array<{ word?: string }>;
  segments?: Array<{ text?: string; no_speech_prob?: number }>;
}

/**
 * Conteo de elementos de HABLA.
 *
 * Con `timestamp_granularities=word` vendría `words`; sin eso hay que aproximar
 * desde los segmentos, descartando los que el propio modelo marca como
 * "probablemente sin voz". Sin ese descarte, un audio de puro ruido contaría
 * palabras alucinadas —Whisper es especialmente propenso a inventarlas sobre
 * silencio— y pasaría como transcrito en vez de quedar INAUDIBLE.
 */
export function contarPalabras(datos: RespuestaCompatibleOpenAI): number {
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

function esAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
}
