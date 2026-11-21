/**
 * 049 — Cómo se convierte un mensaje en el texto que lee el agente.
 *
 * Único punto de verdad, compartido por el constructor de contexto, el gate de
 * autonomía y los Workflows. Si cada uno lo resolviera a su manera, una nota de
 * voz podría estar en el prompt y no en la condición del Workflow —o al revés—
 * y nadie lo notaría hasta ver una respuesta absurda.
 */

export const MARCADOR_VOZ_SIN_TRANSCRIBIR = "[nota de voz no transcrita]";

const PREFIJO_VOZ = "[nota de voz] ";

export interface MensajeTranscribible {
  contenido: string | null;
  tipo?: string | null;
  mediaArchivo?: {
    transcripcion: string | null;
    transcripcionEstado?: string | null;
  } | null;
}

export function esTipoVoz(tipo: string | null | undefined): boolean {
  return tipo === "AUDIO" || tipo === "NOTA_VOZ";
}

/**
 * Texto efectivo de un mensaje para la IA y los Workflows.
 *
 * Devuelve `null` cuando no hay nada que leer, para que el llamador decida si
 * descarta el mensaje o pone un marcador.
 */
export function textoDeMensaje(m: MensajeTranscribible): string | null {
  const propio = m.contenido?.trim();
  if (propio) return propio;

  if (!esTipoVoz(m.tipo)) return null;

  const transcrito = m.mediaArchivo?.transcripcion?.trim();
  // Se prefija para que el agente sepa que el cliente HABLÓ y no escribió: el
  // registro de una nota de voz es distinto del de un mensaje escrito, y una
  // respuesta que lo ignora suena fuera de lugar.
  if (transcrito) return `${PREFIJO_VOZ}${transcrito}`;

  return null;
}

/**
 * Igual que `textoDeMensaje` pero nunca devuelve `null` para un audio.
 *
 * Una nota de voz sin transcripción entra al prompt como marcador en vez de
 * desaparecer: si se omitiera, el agente respondería como si el cliente no
 * hubiera dicho nada —el comportamiento exacto que esta feature corrige— y
 * encima sin saber que hubo algo (FR-027).
 */
export function textoDeMensajeODescarte(m: MensajeTranscribible): string | null {
  const texto = textoDeMensaje(m);
  if (texto) return texto;
  return esTipoVoz(m.tipo) ? MARCADOR_VOZ_SIN_TRANSCRIBIR : null;
}
