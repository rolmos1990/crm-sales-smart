// NO lleva `import "server-only"`: este módulo lo alcanza el worker
// (worker/disparadores.ts → … → acá), que corre con `tsx` en Node pelado y no
// puede resolver ese paquete. Costó una caída del worker en producción con
// MODULE_NOT_FOUND. Lo cubre src/worker/grafo-importaciones.test.ts.
// Adjuntos de un correo entrante (FR-024, FR-025).
//
// No se escribe un camino de almacenamiento propio: se reutilizan los dos que
// el proyecto ya tiene para los otros canales —`subirImagenConversacion` para
// imágenes (las optimiza y genera miniatura) y `guardarArchivoRaw` para todo
// lo demás (PDF, Word, Excel, audio, video)—, que ya resuelven deduplicación
// por hash, proveedor de storage y la fila de MediaArchivo.
import type { Attachment } from "mailparser";
import { normalizarCid } from "./html/limpiar-html";

/** Tope por adjunto. El mismo que ya aplica el servicio de media de conversaciones. */
export const MAX_BYTES_ADJUNTO = 10 * 1024 * 1024;

/** Tope de adjuntos procesados por correo. */
export const MAX_ADJUNTOS = 5;

/**
 * 035 — Tope propio de imágenes EN LÍNEA (las que el HTML usa como `cid:`).
 * Un boletín trae más de 5 logos e íconos: si contaran para MAX_ADJUNTOS,
 * desplazarían a los adjuntos de verdad.
 */
export const MAX_IMAGENES_EN_LINEA = 20;

export interface AdjuntoGuardado {
  mediaArchivoId: string;
  mediaUrl?: string;
  mediaMimeType: string;
  nombre: string;
  esImagen: boolean;
  /** 035 — Tipo que declaró el correo (las imágenes se guardan como webp). */
  mimeTypeDeclarado: string;
  bytes: number;
  /** Content-ID normalizado, si el adjunto lo trae. */
  cid: string | null;
  /** true si el HTML limpio lo muestra como `cid:`: no es un adjunto "visible". */
  enLinea: boolean;
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

function cidDe(adjunto: Attachment): string | null {
  return adjunto.contentId ? normalizarCid(adjunto.contentId) || null : null;
}

type ResultadoUno = { ok: true; adjunto: AdjuntoGuardado } | { ok: false; motivo: string };

async function guardarUno(
  adjunto: Attachment,
  nombre: string,
  enLinea: boolean,
  ctx: { instanciaId: string },
): Promise<ResultadoUno> {
  const mimeType = adjunto.contentType || "application/octet-stream";
  const contenido = adjunto.content;

  if (!contenido || contenido.length === 0) return { ok: false, motivo: "el archivo llegó vacío" };
  if (contenido.length > MAX_BYTES_ADJUNTO) {
    return { ok: false, motivo: `supera los ${MAX_BYTES_ADJUNTO / (1024 * 1024)} MB` };
  }

  const comun = { nombre, mimeTypeDeclarado: mimeType, bytes: contenido.length, cid: cidDe(adjunto), enLinea };

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
      return {
        ok: true,
        adjunto: {
          ...comun,
          mediaArchivoId: resultado.mediaArchivoId,
          mediaUrl: resultado.urlThumbnail ?? resultado.urlOptimizada ?? undefined,
          mediaMimeType: "image/webp",
          esImagen: true,
        },
      };
    }
    const { guardarArchivoRaw } = await import("@/lib/media/services/media-raw.service");
    const resultado = await guardarArchivoRaw({
      buffer: contenido,
      mimeType,
      nombreArchivo: nombre,
      instanciaId: ctx.instanciaId,
      modulo: "conversaciones",
      canalOrigen: "email",
    });
    return {
      ok: true,
      adjunto: {
        ...comun,
        mediaArchivoId: resultado.id,
        mediaUrl: resultado.urlOptimizada,
        mediaMimeType: mimeType,
        esImagen: false,
      },
    };
  } catch (err) {
    // Formato no soportado por el almacenamiento, o un fallo del proveedor.
    // Se anota el nombre, nunca el contenido del archivo.
    return { ok: false, motivo: err instanceof Error ? err.message : "no se pudo guardar" };
  }
}

/**
 * Guarda los adjuntos de un correo.
 *
 * Ningún fallo de un adjunto impide que el correo entre: lo que no se pueda
 * guardar se devuelve en `descartados` y queda anotado en la conversación. Un
 * correo sin su adjunto sigue siendo mejor que un correo perdido.
 *
 * 035 — `cidsUsados` son los `cid:` que usa el HTML limpio. Las imágenes que
 * coinciden se guardan aparte (en línea) y no cuentan para MAX_ADJUNTOS. Sin
 * `cidsUsados` (correo sin HTML disponible) el comportamiento es el de antes.
 */
export async function guardarAdjuntos(
  adjuntos: Attachment[],
  ctx: { instanciaId: string; cidsUsados?: string[] },
): Promise<ResultadoAdjuntos> {
  const guardados: AdjuntoGuardado[] = [];
  const descartados: { nombre: string; motivo: string }[] = [];

  const cids = new Set(ctx.cidsUsados ?? []);
  const esEnLinea = (a: Attachment) => {
    const cid = cidDe(a);
    return cid !== null && cids.has(cid) && esImagen(a.contentType || "");
  };
  const enLinea = adjuntos.filter(esEnLinea);
  const normales = adjuntos.filter((a) => !esEnLinea(a));

  const aProcesar = normales.slice(0, MAX_ADJUNTOS);
  for (const sobrante of normales.slice(MAX_ADJUNTOS)) {
    descartados.push({
      nombre: nombreDe(sobrante, MAX_ADJUNTOS),
      motivo: `se procesan hasta ${MAX_ADJUNTOS} adjuntos por correo`,
    });
  }

  for (const [indice, adjunto] of aProcesar.entries()) {
    const nombre = nombreDe(adjunto, indice);
    const r = await guardarUno(adjunto, nombre, false, ctx);
    if (r.ok) guardados.push(r.adjunto);
    else descartados.push({ nombre, motivo: r.motivo });
  }

  // Una imagen en línea que no se guarda no se anota en el texto: el agente no
  // la ve como adjunto, y en la vista aparece como "imagen no disponible".
  for (const [indice, adjunto] of enLinea.slice(0, MAX_IMAGENES_EN_LINEA).entries()) {
    const r = await guardarUno(adjunto, nombreDe(adjunto, indice), true, ctx);
    if (r.ok) guardados.push(r.adjunto);
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
