import type { IProveedorVoz } from "./types";
import { ErrorProveedorVoz } from "./types";
import { crearProveedorCompatibleOpenAI } from "./openai-compatible";

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
 * El transporte vive en `openai-compatible.ts`, compartido con Groq (050).
 * Acá queda lo que es propio de OpenAI: su URL, su modelo por defecto y su
 * traducción de errores.
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
  return crearProveedorCompatibleOpenAI({
    nombre: "OPENAI",
    etiqueta: "OpenAI",
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
    return new ErrorProveedorVoz("Credencial de OpenAI rechazada", "CREDENCIAL_INVALIDA", false);
  }
  if (status === 413) {
    return new ErrorProveedorVoz(
      "El audio excede el tamaño admitido",
      "ARCHIVO_DEMASIADO_GRANDE",
      false,
    );
  }
  if (status === 429) {
    // OpenAI usa 429 tanto para rate limit como para falta de saldo; los dos
    // se resuelven solos o con una recarga, así que reintentar tiene sentido.
    return new ErrorProveedorVoz("OpenAI limitó la petición", "LIMITE_PROVEEDOR", true);
  }
  if (status === 400) {
    const sinSaldo = /quota|billing|credit/i.test(detalle);
    return sinSaldo
      ? new ErrorProveedorVoz("Sin saldo en OpenAI", "LIMITE_PROVEEDOR", true)
      : new ErrorProveedorVoz("OpenAI rechazó el audio", "FORMATO_NO_SOPORTADO", false);
  }
  return new ErrorProveedorVoz(`OpenAI respondió ${status}`, "ERROR_PROVEEDOR", true);
}
