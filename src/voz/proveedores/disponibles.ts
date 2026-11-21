import type { ProveedorVozEnum } from "@/generated/prisma/enums";

/**
 * 049 — Qué proveedores de voz tienen implementación de verdad.
 *
 * El enum de Prisma lista cuatro, pero solo los que tienen su archivo acá y su
 * registro en inicializar.ts funcionan. Permitir elegir uno de los otros lo
 * guardaría sin una queja y después fallaría en runtime con "Proveedor de voz
 * no registrado" — en el log del servidor, no en pantalla: el comercio creería
 * tener la transcripción activa y en realidad ningún audio se transcribiría.
 *
 * Vive en un archivo sin dependencias de servidor para que lo importen tanto
 * la Server Action que valida el alta como el formulario del navegador.
 * `inicializar.test.ts` lo mantiene sincronizado con el registro real.
 */
export const PROVEEDORES_VOZ_IMPLEMENTADOS = ["ELEVENLABS", "OPENAI", "GROQ"] as const;

export type ProveedorVozImplementado = (typeof PROVEEDORES_VOZ_IMPLEMENTADOS)[number];

export function estaImplementadoVoz(proveedor: string): proveedor is ProveedorVozImplementado {
  return (PROVEEDORES_VOZ_IMPLEMENTADOS as readonly string[]).includes(proveedor);
}

/** Mensaje para el negocio: por qué no puede elegir ese proveedor. */
export function mensajeProveedorVozNoImplementado(proveedor: ProveedorVozEnum | string): string {
  return (
    `El proveedor de voz ${proveedor} todavía no está implementado en Karia. ` +
    `Disponibles: ${PROVEEDORES_VOZ_IMPLEMENTADOS.join(", ")}.`
  );
}

/** Modelos sugeridos en el formulario al elegir cada proveedor. */
export const MODELOS_POR_PROVEEDOR_VOZ: Record<ProveedorVozImplementado, readonly string[]> = {
  ELEVENLABS: ["scribe_v3", "scribe_v2"],
  OPENAI: ["gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1"],
  // `distil-whisper-large-v3-en` queda fuera a propósito: solo entiende inglés
  // y Karia nunca fuerza el idioma, así que traduciría el español en silencio.
  GROQ: ["whisper-large-v3-turbo", "whisper-large-v3"],
};

/**
 * Valor con el que el formulario precarga "costo por hora" al elegir cada
 * servicio. NO es una tarifa: es un punto de partida para que el campo no
 * quede con el número del proveedor anterior, que es lo que pasaba al cambiar
 * de servicio y daba un costo estimado de otro orden de magnitud.
 *
 * El negocio lo confirma contra su propia factura. El precio de lista de un
 * proveedor cambia sin avisarnos, y `costoPorHora` vacío es siempre preferible
 * a uno inventado: sin tarifa no se estima nada (ver calcularCostoVoz).
 */
export const COSTO_HORA_INICIAL_VOZ: Record<ProveedorVozImplementado, number> = {
  ELEVENLABS: 0.2,
  OPENAI: 0.2,
  // Groq cobra por hora de audio y es un orden de magnitud más barato; además
  // factura un mínimo de 10 s por petición, así que en notas de voz cortas el
  // costo real queda por encima de esta estimación.
  GROQ: 0.04,
};
