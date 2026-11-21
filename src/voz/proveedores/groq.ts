import type { IProveedorVoz } from "./types";
import { ErrorProveedorVoz } from "./types";
import { crearProveedorCompatibleOpenAI } from "./openai-compatible";

// El host de Groq sirve su API compatible bajo /openai, así que la base ya
// incluye ese segmento y el transporte común le agrega /v1/audio/transcriptions
// sin saber nada de Groq.
const BASE_URL_POR_DEFECTO = "https://api.groq.com/openai";
const MODELO_POR_DEFECTO = "whisper-large-v3-turbo";

/**
 * 050 — Adaptador de Groq Speech-to-Text (Whisper large v3 y v3 turbo).
 *
 * Groq expone la API de transcripción de OpenAI tal cual, así que el
 * transporte es el mismo (`openai-compatible.ts`) y acá solo vive lo propio:
 * host, modelo por defecto y traducción de errores.
 *
 * Dos cosas que conviene saber antes de tocar esto:
 *
 * - **Groq factura un mínimo de 10 segundos de audio por petición.** Las notas
 *   de voz cortas —que son la mayoría— cuestan más de lo que `UsoVoz.segundos`
 *   sugiere. Ese campo sigue guardando la duración REAL que devuelve el
 *   proveedor, no la facturable: inflarlo a 10 falsearía la métrica de cuánto
 *   audio se transcribió, que es lo que el campo significa. Quien quiera el
 *   costo exacto lo ajusta en `costoPorHora`.
 * - **`distil-whisper-large-v3-en` solo entiende inglés.** Como Karia nunca
 *   fuerza el idioma (ver TranscribirParams.idioma), ese modelo transcribiría
 *   español al inglés en silencio; por eso no está entre los sugeridos.
 */
export function crearGroqVozProvider(
  apiKey: string,
  modelo?: string,
  baseUrl?: string,
): IProveedorVoz {
  return crearProveedorCompatibleOpenAI({
    nombre: "GROQ",
    etiqueta: "Groq",
    apiKey,
    modelo,
    baseUrl,
    baseUrlPorDefecto: BASE_URL_POR_DEFECTO,
    modeloPorDefecto: MODELO_POR_DEFECTO,
    traducirError,
  });
}

function traducirError(status: number, detalle: string): ErrorProveedorVoz {
  if (status === 401 || status === 403) {
    return new ErrorProveedorVoz("Credencial de Groq rechazada", "CREDENCIAL_INVALIDA", false);
  }
  if (status === 413) {
    // Groq corta en 25 MB (tier gratuito) o 100 MB (tier de pago). Subir
    // VOZ_MAX_BYTES por encima del tier contratado se manifiesta acá.
    return new ErrorProveedorVoz(
      "El audio excede el tamaño admitido por Groq",
      "ARCHIVO_DEMASIADO_GRANDE",
      false,
    );
  }
  if (status === 429) {
    // A diferencia de OpenAI, el 429 de Groq es siempre cuota o rate limit
    // —nunca falta de saldo— y las cuotas del tier gratuito se reponen solas.
    return new ErrorProveedorVoz("Groq limitó la petición", "LIMITE_PROVEEDOR", true);
  }
  if (status === 400) {
    // Groq no usa 400 para saldo. Acá cae el audio ilegible y también el
    // modelo retirado; los dos son permanentes, que es lo único que mira la
    // cola, pero el mensaje nombra ambos para no mandar a revisar el audio
    // cuando el problema es el modelo configurado.
    const modeloInvalido = /model/i.test(detalle);
    return new ErrorProveedorVoz(
      modeloInvalido
        ? "Groq rechazó el modelo configurado"
        : "Groq rechazó el audio",
      "FORMATO_NO_SOPORTADO",
      false,
    );
  }
  return new ErrorProveedorVoz(`Groq respondió ${status}`, "ERROR_PROVEEDOR", true);
}
