// 033 — Credenciales del índice documental.
//
// Ojo con una diferencia importante respecto del resto del módulo de IA: acá
// NO se usa el `ProveedorIA` por instancia. La documentación corre con una
// credencial de la plataforma, por entorno, y no con la key del tenant.
//
// El motivo es que así funciona para TODA cuenta: un comercio cuyo agente
// corre sobre Anthropic o DeepSeek no tiene key de OpenAI, y con la otra
// alternativa se quedaría sin documentación. Karia le paga a OpenAI; `UsoIA`
// sigue atribuyendo el consumo por instancia, que es lo que permite medirlo,
// limitarlo y facturarlo.
//
// Cada instancia tiene su PROPIO vector store dentro de esa organización (ver
// vector-store.ts): el índice de un comercio no contiene bytes de otro. Por eso
// acá no hay ningún id de store — ese dato es por tenant y vive en la base.
//
// Si falta la key, la feature se apaga sola: la herramienta no se le ofrece al
// agente y la UI muestra el motivo en vez de un botón que fallaría. Nunca
// lanza por estar sin configurar.

import OpenAI from "openai";

export interface ConfiguracionDocumentacion {
  client: OpenAI;
  modelo: string;
  costoInputPorMil: number | null;
  costoOutputPorMil: number | null;
}

/** Modelo por omisión para sintetizar la respuesta de una búsqueda. Barato a
 *  propósito: el trabajo difícil lo hace la recuperación, no la redacción. */
const MODELO_DEFAULT = "gpt-6-luna";

let cache: ConfiguracionDocumentacion | null = null;

function numeroDeEntorno(valor: string | undefined): number | null {
  if (!valor) return null;
  const n = Number(valor);
  // Sin tarifa válida preferimos `null` a un número equivocado: así
  // `calcularCosto` devuelve undefined y `costoEstimado` queda vacío, que es
  // honesto. Un costo inventado contamina todos los agregados de UsoIA.
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * La configuración, o `null` si la feature no está habilitada en este entorno.
 *
 * Singleton como `getStorageProvider()`: el cliente de OpenAI mantiene su pool
 * de conexiones y no tiene sentido reconstruirlo en cada request.
 */
export function obtenerConfiguracionDocumentacion(): ConfiguracionDocumentacion | null {
  if (cache) return cache;

  const apiKey = process.env.OPENAI_DOCUMENTACION_API_KEY;
  if (!apiKey) return null;

  cache = {
    client: new OpenAI({ apiKey }),
    modelo: process.env.OPENAI_DOCUMENTACION_MODELO || MODELO_DEFAULT,
    costoInputPorMil: numeroDeEntorno(process.env.OPENAI_DOCUMENTACION_COSTO_INPUT_POR_MIL),
    costoOutputPorMil: numeroDeEntorno(process.env.OPENAI_DOCUMENTACION_COSTO_OUTPUT_POR_MIL),
  };

  return cache;
}

/** ¿La feature está habilitada en este entorno? */
export function documentacionHabilitada(): boolean {
  return obtenerConfiguracionDocumentacion() !== null;
}

/** Para los tests: el singleton no puede sobrevivir entre casos que cambian
 *  las variables de entorno. Mismo patrón que `resetStorageProvider()`. */
export function resetConfiguracionDocumentacion(): void {
  cache = null;
}
