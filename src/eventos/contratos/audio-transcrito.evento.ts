/**
 * 049 — Una nota de voz terminó de transcribirse.
 *
 * Existe para un único fin: que una transcripción que termina DESPUÉS de que
 * el mensaje ya se pintó refresque la burbuja sin recargar (FR-025). Pasa
 * siempre que la transcripción en línea vence su timeout y la resuelve el
 * barrido.
 *
 * OJO: ningún suscriptor que marque audios como pendientes puede escuchar este
 * evento. Sería un bucle — transcribir, evento, marcar, transcribir. Mismo
 * criterio que CONTACTO_ANALIZADO en 042.
 */
export interface AudioTranscritoPayload extends Record<string, unknown> {
  version: number;
  instanciaId: string;
  mediaArchivoId: string;
  /** Conversaciones donde aparece este archivo: una sola, salvo reenvío. */
  conversacionIds: string[];
  estado: "LISTO" | "INAUDIBLE" | "ERROR";
  /** Presente en LISTO e INAUDIBLE. Nunca en ERROR. */
  transcripcion?: string;
  idioma?: string | null;
  segundos?: number | null;
}
