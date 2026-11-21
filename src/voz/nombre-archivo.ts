/**
 * 051 — El nombre de archivo que se le manda al proveedor de transcripción.
 *
 * Groq y OpenAI deciden si aceptan un audio **por la extensión del nombre** que
 * viaja en el formulario, antes de mirar un solo byte. ElevenLabs no: identifica
 * el formato por el contenido. Esa diferencia estuvo invisible hasta que una
 * cuenta cambió de proveedor y sus notas de voz empezaron a morir con
 * `FORMATO_NO_SOPORTADO` en 97 ms, siendo MP4 perfectamente válidos.
 *
 * Ningún canal entrega un nombre con extensión: los 744 audios en producción
 * tienen `nombreOriginal` del estilo `audio-1795275488865`, tanto los 738 de
 * Instagram como los 6 de WhatsApp.
 *
 * La extensión sale de la **clave de storage**, nunca del mime. La clave ya la
 * lleva —`extDesde(mime)` se la puso al guardar el archivo,
 * `src/lib/media/services/media-raw.service.ts:134`— y tomarla de ahí evita una
 * segunda lista de mimes que se arregle por separado de la primera, que es el
 * modo clásico de que un formato nuevo funcione al guardarse y falle al
 * transcribirse. De paso resuelve gratis `audio/ogg; codecs=opus`, que ya está
 * mapeado allá.
 */

/** Punto + 1 a 5 alfanuméricos al final. */
const EXTENSION_AL_FINAL = /\.([A-Za-z0-9]{1,5})$/;

const NOMBRE_POR_DEFECTO = "audio";

/**
 * La única pregunta que se hace es si el nombre YA termina en la extensión de
 * la clave. No se intenta adivinar si "parece" tener una.
 *
 * Esa heurística no existe: `archivo.de.audio` termina en `.audio`, cinco
 * caracteres alfanuméricos, indistinguible de una extensión real para cualquier
 * expresión regular. Dejarlo pasar por parecerlo es lo que hace que el audio no
 * se transcriba, que es el bug entero. Agregar la extensión de más deja un
 * nombre feo —`archivo.de.audio.ogg`—, que es un precio que no se compara.
 *
 * La clave manda también sobre un nombre con OTRA extensión: ella refleja lo
 * que el archivo realmente es, y el nombre es un dato suelto del canal.
 */
export function nombreConExtension(nombre: string, claveStorage: string | null): string {
  const base = nombre.trim() || NOMBRE_POR_DEFECTO;

  // En minúsculas porque los proveedores comparan contra una lista en minúsculas.
  const extension = claveStorage?.match(EXTENSION_AL_FINAL)?.[1]?.toLowerCase();

  // Sin extensión en la clave se devuelve el nombre tal cual, que es el
  // comportamiento anterior a 051. El proveedor lo rechaza y hace bien: si el
  // sistema no pudo clasificar el mime al guardarlo, el formato de verdad no se
  // reconoce. Inventar una extensión convertiría un fallo entendible en uno
  // confuso — el audio se mandaría como algo que no es.
  if (!extension) return base;

  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}
