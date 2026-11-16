// Recorte del hilo citado y de la firma (FR-022).
//
// Importa por dos razones: en pantalla, que cada respuesta repita el hilo
// entero vuelve la conversación ilegible; y para la IA, que el historial
// citado se reinyecte en cada mensaje infla el contexto y hace que el agente
// conteste cosas ya contestadas.
//
// Regla de oro: ante la duda, NO recortar. Mostrar de más es barato; perder lo
// que el cliente escribió, no.
import EmailReplyParser from "email-reply-parser";

/** Marcadores de inicio de cita, por si email-reply-parser no encuentra el corte. */
const MARCADORES_CITA = [
  /^-{2,}\s*mensaje original\s*-{2,}/i,
  /^-{2,}\s*original message\s*-{2,}/i,
  /^-{2,}\s*forwarded message\s*-{2,}/i,
  /^el .+ escribi[óo]\s*:?\s*$/i,
  /^on .+ wrote\s*:?\s*$/i,
  /^em .+ escreveu\s*:?\s*$/i,
  /^de\s*:\s*.+<.+@.+>/i,
  /^from\s*:\s*.+<.+@.+>/i,
];

/** Separador de firma del RFC 3676: una línea con exactamente "-- ". */
const SEPARADOR_FIRMA = /^--\s?$/;

function recortePorMarcadores(texto: string): string {
  const lineas = texto.split(/\r?\n/);
  const resultado: string[] = [];

  for (const linea of lineas) {
    const limpia = linea.trim();
    if (MARCADORES_CITA.some((m) => m.test(limpia))) break;
    if (SEPARADOR_FIRMA.test(linea)) break;
    // Una línea citada suelta no corta el mensaje (a veces la gente cita en el
    // medio para responder punto por punto); un bloque citado al final sí lo
    // hace, y de eso ya se ocupa email-reply-parser.
    resultado.push(linea);
  }

  return resultado.join("\n");
}

/**
 * Devuelve solo el texto nuevo escrito por el remitente.
 *
 * Si cualquiera de los dos métodos deja el texto vacío, se devuelve el
 * original: es preferible mostrar el hilo entero a mostrar una conversación
 * en blanco.
 */
export function limpiarCita(texto: string | null | undefined): string {
  const original = (texto ?? "").trim();
  if (!original) return "";

  let visible = "";
  try {
    visible = new EmailReplyParser().read(original).getVisibleText().trim();
  } catch {
    // La librería puede tropezar con entradas raras; seguimos con el respaldo.
    visible = "";
  }

  if (!visible) visible = recortePorMarcadores(original).trim();
  if (!visible) return original;

  // Colapsa las líneas en blanco de más que deja el recorte, sin tocar los
  // párrafos del remitente.
  return visible.replace(/\n{3,}/g, "\n\n").trim();
}
