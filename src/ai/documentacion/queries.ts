// 033 — Lecturas de documentación.
//
// `listarDocumentosAgente` es la frontera que garantiza que ningún
// identificador de OpenAI llegue al navegador: no "filtra al serializar", lisa
// y llanamente no los selecciona de la base. Si mañana alguien agrega un campo
// sensible al modelo, este `select` explícito lo deja afuera por omisión, que
// es el comportamiento que queremos.

import { prisma } from "@/shared/db/prisma";
import { documentacionHabilitada } from "./cliente-openai";
import type { EstadoDocumento } from "./tipos";

/** Lo único que el frontend puede ver de un documento. */
export interface DocumentoAgenteVista {
  id: string;
  nombre: string;
  extension: string;
  pesoBytes: number;
  estado: EstadoDocumento;
  errorIndexacion: string | null;
  activo: boolean;
  /** ISO UTC. El formateo a zona del usuario lo hace la UI con <FechaHora>. */
  creadoEn: string;
}

/** Campos que salen de la base para la UI. Lo que no está acá no viaja, por
 *  construcción: storageKey, openaiFileId, vectorStoreFileId, vectorStoreId. */
const SELECT_VISTA = {
  id: true,
  nombre: true,
  extension: true,
  pesoBytes: true,
  estado: true,
  errorIndexacion: true,
  activo: true,
  creadoEn: true,
} as const;

type FilaVista = {
  id: string;
  nombre: string;
  extension: string;
  pesoBytes: number;
  estado: EstadoDocumento;
  errorIndexacion: string | null;
  activo: boolean;
  creadoEn: Date;
};

export function aVista(fila: FilaVista): DocumentoAgenteVista {
  return { ...fila, creadoEn: fila.creadoEn.toISOString() };
}

export async function listarDocumentosAgente(
  agenteIAConfigId: string,
  instanciaId: string,
): Promise<DocumentoAgenteVista[]> {
  const filas = await prisma.documentoAgenteIA.findMany({
    // El instanciaId acota además de la relación con el agente: un id de
    // agente de otro tenant no encuentra nada.
    where: { agenteIAConfigId, instanciaId },
    select: SELECT_VISTA,
    orderBy: { creadoEn: "asc" },
  });

  return filas.map(aVista);
}

/**
 * Qué documentación tiene efectivamente disponible el agente — FR-019.
 *
 * Decide dos cosas en el runtime de cada respuesta: si se le ofrece la
 * herramienta `buscar_en_documentacion` y si se emite el bloque de política en
 * el contexto. Con 0 documentos, el agente se comporta exactamente como antes
 * de esta feature.
 *
 * Devuelve 0 si la feature no está configurada en el entorno: sin vector store
 * no hay nada que buscar, por más filas que haya en la base.
 */
export async function contarDocumentosListos(
  agenteIAConfigId: string,
): Promise<{ cantidad: number; nombres: string[] }> {
  if (!documentacionHabilitada()) return { cantidad: 0, nombres: [] };

  const filas = await prisma.documentoAgenteIA.findMany({
    where: { agenteIAConfigId, estado: "LISTO", activo: true },
    select: { nombre: true },
    orderBy: { creadoEn: "asc" },
  });

  return { cantidad: filas.length, nombres: filas.map((f) => f.nombre) };
}

/**
 * Cuánto pesa toda la documentación de la cuenta — el límite operativo.
 *
 * El alcance es la INSTANCIA y no el agente a propósito: los 20 MB son un
 * presupuesto de la cuenta, compartido por todos sus agentes. Suma también
 * las filas en ERROR, porque el archivo original igual quedó guardado en el
 * storage de Karia y ocupa espacio real.
 */
export async function sumarPesoInstancia(instanciaId: string): Promise<number> {
  const r = await prisma.documentoAgenteIA.aggregate({
    where: { instanciaId },
    _sum: { pesoBytes: true },
  });

  return r._sum.pesoBytes ?? 0;
}

/** Documento cargado con el mecanismo anterior (032). No es consultable: el
 *  texto destilado que tenía no equivale a un archivo indexado entero. Vive
 *  todavía en la columna `AgenteIAConfig.documentosFaq`. */
export interface DocumentoLegacyVista {
  id: string;
  nombre: string;
}

/** Todo lo que la sección de documentación necesita en una sola llamada. */
export interface EstadoDocumentacionAgente {
  documentos: DocumentoAgenteVista[];
  legacy: DocumentoLegacyVista[];
  /** Si el entorno tiene configurado el índice documental. */
  habilitado: boolean;
  /** Bytes usados por TODA la cuenta, no solo por este agente: es contra esto
   *  que se mide el tope, y por eso la UI tiene que poder mostrarlo. */
  pesoUsadoInstancia: number;
}
