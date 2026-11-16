import "server-only";

// Adjuntos de un correo entrante (FR-024, FR-025).
//
// No se escribe un camino de almacenamiento propio: se reutilizan los dos que
// el proyecto ya tiene para los otros canales —`subirImagenConversacion` para
// imágenes (las optimiza y genera miniatura) y `guardarArchivoRaw` para todo
// lo demás (PDF, Word, Excel, audio, video)—, que ya resuelven deduplicación
// por hash, proveedor de storage y la fila de MediaArchivo.
import type { Attachment } from "mailparser";

/** Tope por adjunto. El mismo que ya aplica el servicio de media de conversaciones. */
export const MAX_BYTES_ADJUNTO = 10 * 1024 * 1024;

/** Tope de adjuntos procesados por correo. */
export const MAX_ADJUNTOS = 5;

export interface AdjuntoGuardado {
  mediaArchivoId: string;
  mediaUrl?: string;
  mediaMimeType: string;
  nombre: string;
  esImagen: boolean;
}

export interface ResultadoAdjuntos {
  guardados: AdjuntoGuardado[];
  /** Nombres de los que no se pudieron guardar, para dejar constancia. */
  descartados: { nombre: string; motivo: string }[];
}

function esImagen(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
}

function nombreDe(adjunto: Attachment, indice: number): string {
  return adjunto.filename?.trim() || `adjunto-${indice + 1}`;
}

/**
 * Guarda los adjuntos de un correo.
 *
 * Ningún fallo de un adjunto impide que el correo entre: lo que no se pueda
 * guardar se devuelve en `descartados` y queda anotado en la conversación. Un
 * correo sin su adjunto sigue siendo mejor que un correo perdido.
 */
export async function guardarAdjuntos(
  adjuntos: Attachment[],
  ctx: { instanciaId: string },
): Promise<ResultadoAdjuntos> {
  const guardados: AdjuntoGuardado[] = [];
  const descartados: { nombre: string; motivo: string }[] = [];

  const aProcesar = adjuntos.slice(0, MAX_ADJUNTOS);
  for (const sobrante of adjuntos.slice(MAX_ADJUNTOS)) {
    descartados.push({
      nombre: nombreDe(sobrante, MAX_ADJUNTOS),
      motivo: `se procesan hasta ${MAX_ADJUNTOS} adjuntos por correo`,
    });
  }

  for (const [indice, adjunto] of aProcesar.entries()) {
    const nombre = nombreDe(adjunto, indice);
    const mimeType = adjunto.contentType || "application/octet-stream";
    const contenido = adjunto.content;

    if (!contenido || contenido.length === 0) {
      descartados.push({ nombre, motivo: "el archivo llegó vacío" });
      continue;
    }
    if (contenido.length > MAX_BYTES_ADJUNTO) {
      descartados.push({
        nombre,
        motivo: `supera los ${MAX_BYTES_ADJUNTO / (1024 * 1024)} MB`,
      });
      continue;
    }

    try {
      if (esImagen(mimeType)) {
        const { subirImagenConversacion } = await import(
          "@/lib/media/services/media-conversacion.service"
        );
        const resultado = await subirImagenConversacion({
          buffer: contenido,
          mimeTypeProveedor: mimeType,
          instanciaId: ctx.instanciaId,
          canal: "email",
          // Se completa en procesarMensajeEntrante, cuando el contacto ya está
          // resuelto — igual que hace WhatsApp.
          contactoId: null,
        });
        guardados.push({
          mediaArchivoId: resultado.mediaArchivoId,
          mediaUrl: resultado.urlThumbnail ?? resultado.urlOptimizada ?? undefined,
          mediaMimeType: "image/webp",
          nombre,
          esImagen: true,
        });
      } else {
        const { guardarArchivoRaw } = await import("@/lib/media/services/media-raw.service");
        const resultado = await guardarArchivoRaw({
          buffer: contenido,
          mimeType,
          nombreArchivo: nombre,
          instanciaId: ctx.instanciaId,
          modulo: "conversaciones",
          canalOrigen: "email",
        });
        guardados.push({
          mediaArchivoId: resultado.id,
          mediaUrl: resultado.urlOptimizada,
          mediaMimeType: mimeType,
          nombre,
          esImagen: false,
        });
      }
    } catch (err) {
      // Formato no soportado por el almacenamiento, o un fallo del proveedor.
      // Se anota el nombre, nunca el contenido del archivo.
      descartados.push({
        nombre,
        motivo: err instanceof Error ? err.message : "no se pudo guardar",
      });
    }
  }

  return { guardados, descartados };
}

/** Línea que se agrega al cuerpo cuando un adjunto no se pudo guardar (FR-025). */
export function avisoAdjuntosDescartados(
  descartados: { nombre: string; motivo: string }[],
): string {
  if (descartados.length === 0) return "";
  const lista = descartados.map((d) => `· ${d.nombre} (${d.motivo})`).join("\n");
  return `\n\n[Adjuntos que no se pudieron guardar:\n${lista}]`;
}
