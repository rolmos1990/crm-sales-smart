import type { TipoMensaje } from "@/generated/prisma/enums";
import { obtenerTranscripcionVozHabilitada } from "@/configuracion/empresa/queries";
import { marcarPendienteSinFallar } from "./cola";
import { configEntornoVoz } from "./config-entorno";

/**
 * 049 — Enganche de la transcripción con la recepción de mensajes.
 *
 * Dos modos, y la diferencia importa:
 *
 *  - ENTRANTE del contacto: se transcribe EN LÍNEA, antes de que se publique
 *    `MensajeRecibido`. Es el único punto que garantiza que la IA y los
 *    Workflows vean el texto, porque los dos cuelgan de ese evento y ganarían
 *    la carrera a cualquier transcripción asíncrona. Corre en el worker, así
 *    que no bloquea el webhook de Meta ni el socket de Baileys: los dos ya
 *    publicaron su comando y respondieron.
 *
 *  - SALIENTE desde la app nativa: solo se encola. Nadie espera ese texto —
 *    no dispara IA— y transcribirlo en línea solo agregaría latencia.
 *
 * En los dos casos, si algo falla la fila queda en la cola y el barrido la
 * termina. La recepción del mensaje NUNCA se ve afectada.
 */

const TIPOS_CON_VOZ: readonly TipoMensaje[] = ["AUDIO", "NOTA_VOZ"];

export function esMensajeDeVoz(tipo: TipoMensaje | string | undefined): boolean {
  return TIPOS_CON_VOZ.includes(tipo as TipoMensaje);
}

/**
 * Encola y, si `enLinea`, intenta transcribir antes de seguir.
 *
 * Nunca lanza y nunca espera más que el timeout de plataforma: lo peor que
 * puede pasar es que el mensaje llegue sin transcripción y la termine el
 * barrido.
 */
export async function engancharTranscripcion(p: {
  instanciaId: string;
  tipo: TipoMensaje | string | undefined;
  mediaArchivoId: string | null | undefined;
  enLinea: boolean;
}): Promise<void> {
  if (!p.mediaArchivoId) return;
  if (!esMensajeDeVoz(p.tipo)) return;

  try {
    if (!(await obtenerTranscripcionVozHabilitada(p.instanciaId))) return;

    await marcarPendienteSinFallar({
      instanciaId: p.instanciaId,
      mediaArchivoId: p.mediaArchivoId,
    });

    if (!p.enLinea) return;

    // Import diferido: el camino de los mensajes que no son de voz —la enorme
    // mayoría— no carga el módulo de transcripción ni sus adaptadores.
    const { transcribirMediaArchivo } = await import("./transcribir");
    const mediaArchivoId = p.mediaArchivoId;

    // El techo real: aunque el adaptador tenga su propio timeout, acá se corta
    // igual. Un proveedor que acepta la conexión y no responde nunca no puede
    // retener la publicación de MensajeRecibido.
    await Promise.race([
      transcribirMediaArchivo(mediaArchivoId),
      new Promise((resolve) => setTimeout(resolve, configEntornoVoz().timeoutMs + 1000)),
    ]);
  } catch (e) {
    console.error("[voz] La transcripción en línea falló; queda para el barrido:", e);
  }
}
