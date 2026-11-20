import type { FamiliaAdjunto, MensajeEntranteNormalizado } from "@/conversaciones/types";
import { textoDescriptivo } from "@/conversaciones/providers/instagram-adjuntos";

export type ResultadoDescarga =
  | { ok: true; url: string; mimeType: string; mediaArchivoId: string }
  | { ok: false; motivo: "FALLO" | "NO_ES_IMAGEN" };

export type PayloadEntrante = Omit<MensajeEntranteNormalizado, "familiaAdjunto" | "tituloAdjunto">;

const FAMILIAS_COMPARTIDAS: ReadonlySet<FamiliaAdjunto> = new Set([
  "PUBLICACION",
  "MENCION_HISTORIA",
  "RESPUESTA_HISTORIA",
]);

/**
 * Arma lo que el webhook publica en la cola a partir del mensaje normalizado y
 * del resultado de reubicar su adjunto en nuestro storage.
 *
 * Garantía (048, FR-001 / research.md R5): la salida solo lleva `mediaUrl` si
 * viene de `resultado.ok` — es decir, una URL de nuestro storage. La URL
 * original de Meta que trae `normalizado.mediaUrl` nunca sale de acá: si no se
 * pudo conservar, se descarta. Los campos internos (`familiaAdjunto`,
 * `tituloAdjunto`) se quitan para no tocar el contrato del comando.
 */
export function prepararPayloadEntrante(
  normalizado: MensajeEntranteNormalizado,
  resultado: ResultadoDescarga | null,
): PayloadEntrante {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { familiaAdjunto, tituloAdjunto, mediaUrl, ...resto } = normalizado;

  if (resultado?.ok) {
    return {
      ...resto,
      ...(familiaAdjunto && FAMILIAS_COMPARTIDAS.has(familiaAdjunto) ? { tipo: "IMAGEN" as const } : {}),
      mediaUrl: resultado.url,
      mediaMimeType: resultado.mimeType,
      mediaArchivoId: resultado.mediaArchivoId,
    };
  }

  // Contenido compartido sin imagen guardada: queda como texto. Solo un FALLO
  // real lleva la aclaración; un video omitido a propósito (NO_ES_IMAGEN) no
  // (research.md R0). En la respuesta a historia el texto es del contacto y no
  // se toca. La media directa conserva su tipo, como antes de 048.
  if (familiaAdjunto && FAMILIAS_COMPARTIDAS.has(familiaAdjunto)) {
    const huboFallo = resultado?.ok === false && resultado.motivo === "FALLO";
    const contenido =
      huboFallo && familiaAdjunto !== "RESPUESTA_HISTORIA"
        ? textoDescriptivo(familiaAdjunto, { titulo: tituloAdjunto, fallo: true })
        : resto.contenido;
    return { ...resto, tipo: "TEXTO", contenido, mediaUrl: undefined, mediaMimeType: undefined, mediaArchivoId: undefined };
  }

  return { ...resto, mediaUrl: undefined };
}
