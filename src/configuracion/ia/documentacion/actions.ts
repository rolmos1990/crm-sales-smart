"use server";

// 033 — Subir, eliminar, activar y reintentar documentos del agente.
//
// Reemplaza a src/configuracion/ia/conocimiento/actions.ts. A diferencia de
// aquel, acá NADA viaja en el formulario del agente: los documentos se manejan
// solo por estas acciones, con efecto inmediato. Esa es la razón de fondo por
// la que los identificadores de OpenAI no pueden filtrarse al navegador — si
// los documentos hicieran round-trip por el form, o viajarían al cliente o se
// borrarían al guardar el perfil.

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { getStorageProvider } from "@/lib/media/providers/factory";
import { documentacionHabilitada } from "@/ai/documentacion/cliente-openai";
import { verificarPdfTieneTexto } from "@/ai/documentacion/extraccion";
import { eliminarArchivo, indexarArchivo } from "@/ai/documentacion/vector-store";
import {
  aVista,
  listarDocumentosAgente,
  sumarPesoInstancia,
  type DocumentoAgenteVista,
  type DocumentoLegacyVista,
  type EstadoDocumentacionAgente,
} from "@/ai/documentacion/queries";
import {
  MENSAJE_RECHAZO,
  validarArchivo,
  type MotivoRechazo,
} from "@/ai/documentacion/tipos";

type Resultado<T = void> = { exito: true; datos?: T } | { exito: false; error: string };

const rechazo = (motivo: MotivoRechazo): Resultado<never> => ({
  exito: false,
  error: MENSAJE_RECHAZO[motivo],
});

/** Autoriza y devuelve el agente. El `instanciaId` sale de la SESIÓN y nunca
 *  de un parámetro: un id de agente de otro tenant no encuentra nada. */
async function autorizar(agenteIAConfigId: string) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { ok: false as const, error: error ?? "Sin permisos" };

  const agente = await prisma.agenteIAConfig.findFirst({
    where: { id: agenteIAConfigId, instanciaId: sesion.instanciaId },
    select: { id: true },
  });
  if (!agente) return { ok: false as const, error: "Agente no encontrado" };

  return { ok: true as const, agenteId: agente.id, instanciaId: sesion.instanciaId };
}

function refrescar() {
  revalidatePath("/configuracion");
}

/**
 * Todo lo que la sección necesita, en una sola llamada.
 *
 * El componente carga su propio estado (mismo patrón que
 * SeccionVersionesAgente) en vez de recibirlo por props del formulario del
 * agente. Es justamente lo que permite que los identificadores de OpenAI no
 * tengan por dónde filtrarse: nunca pasan por el form.
 */
export async function cargarDocumentacionAgente(
  agenteIAConfigId: string,
): Promise<EstadoDocumentacionAgente> {
  const auth = await autorizar(agenteIAConfigId);
  if (!auth.ok) {
    return { documentos: [], legacy: [], habilitado: false, pesoUsadoInstancia: 0 };
  }

  const [documentos, legacy, pesoUsadoInstancia] = await Promise.all([
    listarDocumentosAgente(auth.agenteId, auth.instanciaId),
    listarLegacyDe(auth.agenteId),
    sumarPesoInstancia(auth.instanciaId),
  ]);

  return { documentos, legacy, habilitado: documentacionHabilitada(), pesoUsadoInstancia };
}

export async function subirDocumento(
  agenteIAConfigId: string,
  formData: FormData,
): Promise<Resultado<DocumentoAgenteVista>> {
  const auth = await autorizar(agenteIAConfigId);
  if (!auth.ok) return { exito: false, error: auth.error };
  if (!documentacionHabilitada()) return rechazo("NO_CONFIGURADO");

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) return { exito: false, error: "No se recibió ningún archivo" };

  // Dos alcances distintos y no se mezclan: la cantidad es por AGENTE (tope de
  // cordura contra el techo de archivos de OpenAI) y el peso es por INSTANCIA
  // (el límite real, compartido por todos los agentes de la cuenta).
  const [cantidadActual, pesoAcumulado] = await Promise.all([
    prisma.documentoAgenteIA.count({ where: { agenteIAConfigId: auth.agenteId } }),
    sumarPesoInstancia(auth.instanciaId),
  ]);

  // El cliente ya validó para dar feedback inmediato, pero este es el boundary
  // de verdad: un POST directo se saltea el navegador (FR-003).
  const validacion = validarArchivo(archivo.name, archivo.size, cantidadActual, pesoAcumulado);
  if (!validacion.ok) return { exito: false, error: validacion.mensaje };

  const bytes = Buffer.from(await archivo.arrayBuffer());

  // Un PDF escaneado OpenAI lo aceptaría, lo indexaría vacío y lo cobraría.
  // Rechazarlo acá ahorra ese costo y da un mensaje que se entiende.
  if (validacion.extension === ".pdf") {
    const pdf = await verificarPdfTieneTexto(new Uint8Array(bytes));
    if (!pdf.ok) return rechazo(pdf.motivo);
  }

  const id = crypto.randomUUID();
  const storageKey = `${auth.instanciaId}/agentes/${auth.agenteId}/documentacion/${id}${validacion.extension}`;

  try {
    await getStorageProvider().upload({
      key: storageKey,
      buffer: bytes,
      contentType: validacion.mime,
      metadata: { agenteIAConfigId: auth.agenteId, nombreOriginal: archivo.name },
    });
  } catch (err) {
    console.error("[Documentacion] Falló la subida al storage:", err);
    return { exito: false, error: "No se pudo guardar el archivo. Intentá de nuevo." };
  }

  const nombre = archivo.name.slice(0, 200);

  // La fila se crea ANTES de indexar, en INDEXANDO: si el proceso se cae a
  // mitad, queda un documento visible y reintentable en vez de un archivo
  // huérfano en el storage que nadie sabe que existe.
  const fila = await prisma.documentoAgenteIA.create({
    data: {
      id,
      nombre,
      extension: validacion.extension,
      mime: validacion.mime,
      pesoBytes: archivo.size,
      storageKey,
      estado: "INDEXANDO",
      agenteIAConfigId: auth.agenteId,
      instanciaId: auth.instanciaId,
    },
  });

  const indexacion = await indexarArchivo({
    identidad: { instanciaId: auth.instanciaId, agenteId: auth.agenteId, documentoId: id },
    nombreOriginal: nombre,
    contenido: bytes,
    mime: validacion.mime,
  });

  const actualizada = await prisma.documentoAgenteIA.update({
    where: { id: fila.id },
    data: indexacion.ok
      ? {
          estado: "LISTO",
          errorIndexacion: null,
          openaiFileId: indexacion.openaiFileId,
          vectorStoreFileId: indexacion.vectorStoreFileId,
          vectorStoreId: indexacion.vectorStoreId,
        }
      : { estado: "ERROR", errorIndexacion: indexacion.motivo },
  });

  refrescar();
  return { exito: true, datos: aVista(actualizada) };
}

/**
 * Borrado real — FR-009. El orden importa:
 *
 * primero OpenAI (desindexar + borrar el File), después el storage, y la fila
 * al final. Si algo falla en OpenAI se aborta y la fila queda: en un índice
 * compartido, un documento que sigue siendo consultable pero ya no figura en
 * ninguna lista es exactamente el problema de aislamiento que esta feature
 * existe para no tener.
 */
export async function eliminarDocumento(
  agenteIAConfigId: string,
  documentoId: string,
): Promise<Resultado> {
  const auth = await autorizar(agenteIAConfigId);
  if (!auth.ok) return { exito: false, error: auth.error };

  const doc = await prisma.documentoAgenteIA.findFirst({
    where: { id: documentoId, agenteIAConfigId: auth.agenteId, instanciaId: auth.instanciaId },
  });
  if (!doc) return { exito: false, error: "El documento ya no existe" };

  const borrado = await eliminarArchivo({
    vectorStoreId: doc.vectorStoreId,
    vectorStoreFileId: doc.vectorStoreFileId,
    openaiFileId: doc.openaiFileId,
  });

  if (!borrado.ok) {
    return {
      exito: false,
      error: "No se pudo eliminar el documento del índice. Intentá de nuevo en unos minutos.",
    };
  }

  try {
    await getStorageProvider().delete(doc.storageKey);
  } catch (err) {
    // El storage de Karia no es consultable por el agente: un huérfano acá
    // cuesta espacio, no aislamiento. No se aborta el borrado por esto.
    console.error("[Documentacion] No se pudo borrar el archivo del storage:", err);
  }

  await prisma.documentoAgenteIA.delete({ where: { id: doc.id } });

  refrescar();
  return { exito: true };
}

export async function alternarActivo(
  agenteIAConfigId: string,
  documentoId: string,
  activo: boolean,
): Promise<Resultado<DocumentoAgenteVista>> {
  const auth = await autorizar(agenteIAConfigId);
  if (!auth.ok) return { exito: false, error: auth.error };

  const { count } = await prisma.documentoAgenteIA.updateMany({
    where: { id: documentoId, agenteIAConfigId: auth.agenteId, instanciaId: auth.instanciaId },
    data: { activo },
  });
  if (count === 0) return { exito: false, error: "El documento ya no existe" };

  const fila = await prisma.documentoAgenteIA.findUniqueOrThrow({ where: { id: documentoId } });

  refrescar();
  return { exito: true, datos: aVista(fila) };
}

/**
 * Reintenta una indexación fallida — FR-010.
 *
 * Relee el archivo del storage de Karia: por eso guardamos la copia original.
 * Pedirle al negocio que vuelva a subir un archivo porque nuestra key estaba
 * vencida sería trasladarle nuestro problema.
 */
export async function reintentarIndexacion(
  agenteIAConfigId: string,
  documentoId: string,
): Promise<Resultado<DocumentoAgenteVista>> {
  const auth = await autorizar(agenteIAConfigId);
  if (!auth.ok) return { exito: false, error: auth.error };
  if (!documentacionHabilitada()) return rechazo("NO_CONFIGURADO");

  const doc = await prisma.documentoAgenteIA.findFirst({
    where: { id: documentoId, agenteIAConfigId: auth.agenteId, instanciaId: auth.instanciaId },
  });
  if (!doc) return { exito: false, error: "El documento ya no existe" };
  if (doc.estado !== "ERROR") return { exito: false, error: "Este documento no necesita reintento" };

  const archivo = await getStorageProvider().download(doc.storageKey);
  if (!archivo) {
    return { exito: false, error: "El archivo original ya no está disponible. Subilo de nuevo." };
  }

  await prisma.documentoAgenteIA.update({
    where: { id: doc.id },
    data: { estado: "INDEXANDO", errorIndexacion: null },
  });

  const indexacion = await indexarArchivo({
    identidad: { instanciaId: auth.instanciaId, agenteId: auth.agenteId, documentoId: doc.id },
    nombreOriginal: doc.nombre,
    contenido: archivo.buffer,
    mime: doc.mime,
  });

  const actualizada = await prisma.documentoAgenteIA.update({
    where: { id: doc.id },
    data: indexacion.ok
      ? {
          estado: "LISTO",
          errorIndexacion: null,
          openaiFileId: indexacion.openaiFileId,
          vectorStoreFileId: indexacion.vectorStoreFileId,
          vectorStoreId: indexacion.vectorStoreId,
        }
      : { estado: "ERROR", errorIndexacion: indexacion.motivo },
  });

  refrescar();
  return { exito: true, datos: aVista(actualizada) };
}

// ─── Documentos del mecanismo anterior (032) ────────────────────────────────

/** Helper interno: ya se autorizó el agente, no se vuelve a verificar. */
async function listarLegacyDe(agenteId: string): Promise<DocumentoLegacyVista[]> {
  const agente = await prisma.agenteIAConfig.findUnique({
    where: { id: agenteId },
    select: { documentosFaq: true },
  });

  const valor = agente?.documentosFaq;
  if (!Array.isArray(valor)) return [];

  return valor
    .filter((d): d is { id: string; nombre: string } =>
      !!d && typeof d === "object" && typeof (d as { id?: unknown }).id === "string",
    )
    .map((d) => ({ id: d.id, nombre: typeof d.nombre === "string" ? d.nombre : "Documento" }));
}

/**
 * Elimina un documento heredado — FR-031.
 *
 * No toca OpenAI: estos nunca se indexaron. Solo borra el archivo del storage
 * de Karia y lo saca de la columna.
 */
export async function eliminarDocumentoLegacy(
  agenteIAConfigId: string,
  documentoId: string,
): Promise<Resultado> {
  const auth = await autorizar(agenteIAConfigId);
  if (!auth.ok) return { exito: false, error: auth.error };

  const agente = await prisma.agenteIAConfig.findUnique({
    where: { id: auth.agenteId },
    select: { documentosFaq: true },
  });

  const valor = agente?.documentosFaq;
  if (!Array.isArray(valor)) return { exito: false, error: "El documento ya no existe" };

  const restantes = valor.filter(
    (d) => !(d && typeof d === "object" && (d as { id?: unknown }).id === documentoId),
  );
  if (restantes.length === valor.length) return { exito: false, error: "El documento ya no existe" };

  const eliminado = valor.find(
    (d) => d && typeof d === "object" && (d as { id?: unknown }).id === documentoId,
  ) as { storageKey?: unknown } | undefined;

  await prisma.agenteIAConfig.update({
    where: { id: auth.agenteId },
    data: { documentosFaq: restantes as unknown as Prisma.InputJsonValue },
  });

  if (typeof eliminado?.storageKey === "string") {
    try {
      await getStorageProvider().delete(eliminado.storageKey);
    } catch (err) {
      console.error("[Documentacion] No se pudo borrar el archivo legacy del storage:", err);
    }
  }

  refrescar();
  return { exito: true };
}
