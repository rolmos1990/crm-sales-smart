import type { FamiliaAdjunto } from "../types";

// Los strings de `attachments[].type` salen de la documentación de Meta
// (specs/048-fix-instagram-reels-media/research.md, R1). Agrupados por
// familia: Meta deprecó `share` en favor de `ig_post` y documenta `story` /
// `ig_story` junto a `story_mention` sin decir si son sinónimos — tratarlos
// igual evita que el próximo renombre vuelva a dejar el mensaje vacío.
const DIRECTA = new Set(["image", "video", "audio", "file"]);
const REEL = new Set(["ig_reel", "reel"]);
const PUBLICACION = new Set(["share", "ig_post", "media"]);
const MENCION_HISTORIA = new Set(["story_mention", "story", "ig_story"]);
const EFIMERO = new Set(["ephemeral"]);

const LARGO_MAXIMO_TITULO = 200;

export const TEXTO_HISTORICO_NO_DISPONIBLE = "Contenido compartido que ya no está disponible";

export function clasificarAdjuntoInstagram(
  tipoMeta: string | undefined,
  esNoAdmitido?: boolean,
): FamiliaAdjunto {
  if (esNoAdmitido || !tipoMeta) return "NO_ADMITIDO";
  if (DIRECTA.has(tipoMeta)) return "DIRECTA";
  if (REEL.has(tipoMeta)) return "REEL";
  if (PUBLICACION.has(tipoMeta)) return "PUBLICACION";
  if (MENCION_HISTORIA.has(tipoMeta)) return "MENCION_HISTORIA";
  if (EFIMERO.has(tipoMeta)) return "EFIMERO";
  return "NO_ADMITIDO";
}

export interface OpcionesTextoDescriptivo {
  titulo?: string;
  texto?: string;
  /** La imagen se intentó guardar y falló. No se usa cuando el contenido era
   *  un video omitido a propósito (research.md R0). */
  fallo?: boolean;
  canal?: "instagram" | "facebook_messenger";
}

function conTitulo(base: string, titulo: string | undefined): string {
  const limpio = titulo?.trim();
  if (!limpio) return base;
  return `${base}: «${limpio.slice(0, LARGO_MAXIMO_TITULO)}»`;
}

const SUFIJO_FALLO = " (no se pudo guardar la imagen)";

/** Texto de `MensajeConversacion.contenido` para cada familia — única fuente
 *  de estos strings (contracts/texto-descriptivo.md). Es lo que leen el inbox,
 *  la búsqueda, la IA y los Workflows. */
export function textoDescriptivo(
  familia: FamiliaAdjunto,
  opciones: OpcionesTextoDescriptivo = {},
): string | undefined {
  const { titulo, texto, fallo, canal = "instagram" } = opciones;
  switch (familia) {
    case "DIRECTA":
      return undefined;
    case "REEL":
      return conTitulo("Compartió un Reel", titulo);
    case "PUBLICACION":
      return conTitulo("Compartió una publicación", titulo) + (fallo ? SUFIJO_FALLO : "");
    case "MENCION_HISTORIA":
      return "Te mencionó en su historia" + (fallo ? SUFIJO_FALLO : "");
    case "RESPUESTA_HISTORIA": {
      // La respuesta es texto del contacto: sin sufijo de fallo, para no
      // ensuciar lo que escribió.
      const respuesta = texto?.trim();
      return respuesta ? `Respondió a tu historia: ${respuesta}` : "Respondió a tu historia";
    }
    case "EFIMERO":
      return "Envió contenido temporal que no puede guardarse";
    case "NO_ADMITIDO":
      return canal === "facebook_messenger"
        ? "Envió un contenido que Messenger no permite mostrar"
        : "Envió un contenido que Instagram no permite mostrar";
  }
}
