"use server";

// 032 — Subir, eliminar y re-destilar documentos de la base de conocimiento.
//
// Subir y eliminar viven acá y no en el formulario del agente porque mueven
// archivos en el storage: no pueden ser parte del "guardar" optimista del
// perfil ni deshacerse con un descartar cambios.

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { getStorageProvider } from "@/lib/media/providers/factory";
import { extraerTexto } from "./extraccion";
import { destilarDocumento, recortarEnLimite } from "./destilado";
import {
  MAX_CARACTERES_DOCUMENTO,
  MAX_DOCUMENTOS_FAQ,
  MAX_PESO_DOCUMENTO,
  MENSAJE_RECHAZO,
  MIMES_DOCUMENTO_FAQ,
  type DocumentoFaq,
  necesitaEntrenamiento,
  type MimeDocumentoFaq,
  type MotivoRechazo,
} from "./tipos";

type Resultado<T = void> = { exito: true; datos?: T } | { exito: false; error: string };

const rechazo = (motivo: MotivoRechazo): Resultado<never> => ({ exito: false, error: MENSAJE_RECHAZO[motivo] });

/** Lee la columna y la deja tipada, tolerando filas previas a esta feature. */
function documentosDe(valor: Prisma.JsonValue | null): DocumentoFaq[] {
  return Array.isArray(valor) ? (valor as unknown as DocumentoFaq[]) : [];
}

/** Autoriza y devuelve el agente con sus documentos. El `instanciaId` de la
 *  sesión acota la búsqueda: un id de otro tenant no encuentra nada. */
async function autorizar(agenteIAConfigId: string) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { ok: false as const, error: error ?? "Sin permisos" };

  const agente = await prisma.agenteIAConfig.findFirst({
    where: { id: agenteIAConfigId, instanciaId: sesion.instanciaId },
    select: { id: true, documentosFaq: true },
  });
  if (!agente) return { ok: false as const, error: "Agente no encontrado" };

  return { ok: true as const, agente, instanciaId: sesion.instanciaId };
}

async function guardar(agenteIAConfigId: string, documentos: DocumentoFaq[]) {
  await prisma.agenteIAConfig.update({
    where: { id: agenteIAConfigId },
    data: { documentosFaq: documentos as unknown as Prisma.InputJsonValue },
  });
  revalidatePath("/configuracion");
}

export async function subirDocumentoFaq(
  agenteIAConfigId: string,
  formData: FormData,
): Promise<Resultado<DocumentoFaq>> {
  const auth = await autorizar(agenteIAConfigId);
  if (!auth.ok) return { exito: false, error: auth.error };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) return { exito: false, error: "No se recibió ningún archivo" };

  const existentes = documentosDe(auth.agente.documentosFaq);
  if (existentes.length >= MAX_DOCUMENTOS_FAQ) return rechazo("LIMITE_ALCANZADO");

  // El tipo se decide por extensión además del MIME: algunos navegadores
  // mandan text/plain vacío o application/octet-stream para .txt.
  const esTxt = archivo.name.toLowerCase().endsWith(".txt");
  const mime: MimeDocumentoFaq | null = archivo.type === "application/pdf"
    ? "application/pdf"
    : esTxt || archivo.type === "text/plain"
      ? "text/plain"
      : null;
  if (!mime || !MIMES_DOCUMENTO_FAQ.includes(mime)) return rechazo("MIME_NO_SOPORTADO");
  if (archivo.size > MAX_PESO_DOCUMENTO) return rechazo("DEMASIADO_PESADO");

  const bytes = new Uint8Array(await archivo.arrayBuffer());

  // Extraer ANTES de subir al storage: si el archivo no sirve, no queda
  // basura huérfana en S3 que después nadie limpia.
  const extraccion = await extraerTexto(bytes, mime);
  if (!extraccion.ok) return rechazo(extraccion.motivo);

  const id = crypto.randomUUID();
  const storageKey = `${auth.instanciaId}/agentes/${agenteIAConfigId}/conocimiento/${id}${mime === "application/pdf" ? ".pdf" : ".txt"}`;

  try {
    await getStorageProvider().upload({
      key: storageKey,
      buffer: Buffer.from(bytes),
      contentType: mime,
      metadata: { agenteIAConfigId, nombreOriginal: archivo.name },
    });
  } catch (err) {
    console.error("[ConocimientoFAQ] Falló la subida al storage:", err);
    return { exito: false, error: "No se pudo guardar el archivo. Intentá de nuevo." };
  }

  const documento: DocumentoFaq = {
    id,
    nombre: archivo.name.slice(0, 200),
    mime,
    pesoBytes: archivo.size,
    storageKey,
    subidoEn: new Date().toISOString(),
    // Nace activo: el negocio lo subió para que el agente lo use. Pero nace
    // SIN_ENTRENAR, así que todavía no llega al contexto — hace falta apretar
    // "Entrenar". Mientras tanto se guarda un anticipo del texto crudo para
    // que se vea de qué se trata el archivo.
    activo: true,
    estado: "SIN_ENTRENAR",
    contenido: recortarEnLimite(extraccion.texto, MAX_CARACTERES_DOCUMENTO),
    caracteresOriginal: extraccion.texto.length,
  };

  await guardar(agenteIAConfigId, [...existentes, documento]);
  return { exito: true, datos: documento };
}

export async function eliminarDocumentoFaq(agenteIAConfigId: string, documentoId: string): Promise<Resultado> {
  const auth = await autorizar(agenteIAConfigId);
  if (!auth.ok) return { exito: false, error: auth.error };

  const existentes = documentosDe(auth.agente.documentosFaq);
  const doc = existentes.find((d) => d.id === documentoId);
  if (!doc) return { exito: false, error: "El documento ya no existe" };

  // Primero la fila: si el borrado del storage falla, lo peor que queda es un
  // archivo huérfano. Al revés quedaría un documento listado que ya no existe.
  await guardar(agenteIAConfigId, existentes.filter((d) => d.id !== documentoId));

  try {
    await getStorageProvider().delete(doc.storageKey);
  } catch (err) {
    console.error("[ConocimientoFAQ] No se pudo borrar el archivo del storage:", err);
  }

  return { exito: true };
}

/**
 * Entrena los documentos que todavía no pasaron por el destilado: los
 * convierte al formato compacto que el agente consume. Hasta que esto no
 * corre, el documento está cargado pero el agente no lo usa.
 *
 * Re-lee el archivo del storage en vez de guardar el texto crudo completo en
 * la columna: tres manuales enteros inflarían el JSON del agente y, peor, el
 * snapshot de CADA versión publicada.
 *
 * Solo toca los SIN_ENTRENAR a propósito: volver a entrenar uno ya entrenado
 * pisaría las correcciones que una persona escribió a mano.
 */
export async function entrenarDocumentosFaq(
  agenteIAConfigId: string,
): Promise<Resultado<{ entrenados: number; fallidos: number; documentos: DocumentoFaq[] }>> {
  const auth = await autorizar(agenteIAConfigId);
  if (!auth.ok) return { exito: false, error: auth.error };

  const existentes = documentosDe(auth.agente.documentosFaq);
  const pendientes = existentes.filter(necesitaEntrenamiento);
  if (pendientes.length === 0) return { exito: false, error: "No hay documentos para entrenar" };

  const storage = getStorageProvider();
  let entrenados = 0;
  let fallidos = 0;

  const actualizados = await Promise.all(
    existentes.map(async (doc): Promise<DocumentoFaq> => {
      if (!necesitaEntrenamiento(doc)) return doc;

      try {
        const archivo = await storage.download(doc.storageKey);
        if (!archivo) throw new Error(`El archivo ya no está en el storage: ${doc.storageKey}`);

        const extraccion = await extraerTexto(new Uint8Array(archivo.buffer), doc.mime);
        if (!extraccion.ok) throw new Error(`No se pudo releer el archivo: ${extraccion.motivo}`);

        const { contenido, destilado } = await destilarDocumento(extraccion.texto, auth.instanciaId);
        if (destilado) entrenados++;
        else fallidos++;

        return { ...doc, contenido, estado: destilado ? "LISTO" : "REVISAR", caracteresOriginal: extraccion.texto.length };
      } catch (err) {
        console.error(`[ConocimientoFAQ] No se pudo entrenar "${doc.nombre}":`, err);
        fallidos++;
        // Queda con el anticipo crudo que ya tenía, pero marcado para revisar:
        // así el negocio ve que algo pasó en vez de creer que se entrenó.
        return { ...doc, estado: "REVISAR" };
      }
    }),
  );

  await guardar(agenteIAConfigId, actualizados);
  return { exito: true, datos: { entrenados, fallidos, documentos: actualizados } };
}
