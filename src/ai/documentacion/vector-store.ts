// 033 — Ciclo de vida del vector store y de los archivos en OpenAI.
//
// Es uno de los dos adaptadores del proveedor (el otro es busqueda.ts): ningún
// tipo ni código de error del SDK de OpenAI cruza estas firmas, como pide el
// Principio IV de la constitución.
//
// Hay UN VECTOR STORE POR INSTANCIA. Eso hace que el aislamiento entre cuentas
// sea físico —el índice de un comercio no contiene bytes de otro— y que el
// techo de 10.000 archivos por store sea por cuenta en vez de para toda la
// plataforma. Las cuatro capas de aislamiento.ts siguen igual, pero ahora
// operan como defensa en profundidad y no como única línea.
//
// Dentro de la cuenta, los documentos siguen perteneciendo a un agente: la
// identidad y el filtro llevan `agenteId`, así el agente Comercial y el de
// Gerencia pueden tener documentación distinta.
//
// `indexarArchivo` no recibe `attributes` y resuelve el store por su cuenta:
// no hay forma de crear un archivo sin identidad ni en el store equivocado.

import { prisma } from "@/shared/db/prisma";
import { atributosArchivo, nombreArchivoOpenAI, type IdentidadDocumento } from "./aislamiento";
import { obtenerConfiguracionDocumentacion } from "./cliente-openai";

export interface SolicitudIndexacion {
  identidad: IdentidadDocumento;
  nombreOriginal: string;
  contenido: Buffer;
  mime: string;
}

export type ResultadoIndexacion =
  | { ok: true; openaiFileId: string; vectorStoreFileId: string; vectorStoreId: string }
  | { ok: false; motivo: string };

export interface ReferenciaArchivo {
  vectorStoreId: string | null;
  vectorStoreFileId: string | null;
  openaiFileId: string | null;
}

/** Un 404 al borrar significa "ya no está", que es exactamente lo que
 *  queríamos. Cualquier otro error sí importa: un archivo que creímos borrado
 *  y sigue indexado le responde consultas a alguien. */
function esNoEncontrado(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { status?: number }).status === 404;
}

function mensajeDeError(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as { status?: number; message?: string };
    if (e.status && e.message) return `OpenAI ${e.status}: ${e.message}`;
    if (e.message) return e.message;
  }
  return String(err);
}

/** El store de una cuenta, si ya lo tiene. `null` = todavía no subió nada, y
 *  entonces no hay nada que buscar. */
export async function vectorStoreDeInstancia(instanciaId: string): Promise<string | null> {
  const instancia = await prisma.instancia.findUnique({
    where: { id: instanciaId },
    select: { vectorStoreDocumentacionId: true },
  });
  return instancia?.vectorStoreDocumentacionId ?? null;
}

/**
 * El store de la cuenta, creándolo si es la primera vez.
 *
 * No se pueden pre-crear a mano N stores, uno por tenant, así que la creación
 * es perezosa. El detalle que importa es la **carrera**: dos subidas
 * simultáneas de la misma cuenta podrían crear dos stores y dejar la mitad de
 * los documentos en un índice que después nadie consulta.
 *
 * Se resuelve con un UPDATE condicional (`where vectorStoreDocumentacionId:
 * null`): gana uno solo, y el que pierde borra el store que acababa de crear
 * y se queda con el del ganador. Sin locks ni transacciones largas.
 */
export async function asegurarVectorStoreInstancia(
  instanciaId: string,
): Promise<{ ok: true; vectorStoreId: string } | { ok: false; motivo: string }> {
  const config = obtenerConfiguracionDocumentacion();
  if (!config) return { ok: false, motivo: "La documentación no está habilitada en este entorno" };

  const existente = await vectorStoreDeInstancia(instanciaId);
  if (existente) return { ok: true, vectorStoreId: existente };

  let creado: string;
  try {
    const store = await config.client.vectorStores.create({
      name: `karia-${instanciaId}`,
      metadata: { app: "karia", instanciaId },
    });
    creado = store.id;
  } catch (err) {
    console.error("[Documentacion] No se pudo crear el vector store:", err);
    return { ok: false, motivo: mensajeDeError(err) };
  }

  const { count } = await prisma.instancia.updateMany({
    where: { id: instanciaId, vectorStoreDocumentacionId: null },
    data: { vectorStoreDocumentacionId: creado },
  });

  if (count > 0) return { ok: true, vectorStoreId: creado };

  // Perdimos la carrera: otro request ya dejó su store. El nuestro queda
  // vacío y facturando, así que se borra.
  try {
    await config.client.vectorStores.delete(creado);
  } catch (err) {
    console.error(`[Documentacion] Quedó un vector store huérfano (${creado}):`, err);
  }

  const ganador = await vectorStoreDeInstancia(instanciaId);
  return ganador
    ? { ok: true, vectorStoreId: ganador }
    : { ok: false, motivo: "No se pudo resolver el vector store de la cuenta" };
}

/**
 * Sube el archivo a OpenAI y lo agrega al store de SU cuenta, con su identidad
 * de tenant y de agente.
 *
 * Espera a que termine de procesarse (`createAndPoll`) en vez de devolver
 * enseguida: un documento que figura "Listo" pero todavía no es consultable es
 * peor que un segundo más de espera en la carga.
 */
export async function indexarArchivo(s: SolicitudIndexacion): Promise<ResultadoIndexacion> {
  const config = obtenerConfiguracionDocumentacion();
  if (!config) return { ok: false, motivo: "La documentación no está habilitada en este entorno" };

  const store = await asegurarVectorStoreInstancia(s.identidad.instanciaId);
  if (!store.ok) return { ok: false, motivo: store.motivo };

  const vectorStoreId = store.vectorStoreId;
  const filename = nombreArchivoOpenAI(s.identidad, s.nombreOriginal);

  let openaiFileId: string | null = null;

  try {
    const archivo = await config.client.files.create({
      // El File del SDK es el estándar del runtime, no un tipo de OpenAI.
      file: new File([new Uint8Array(s.contenido)], filename, { type: s.mime }),
      purpose: "assistants",
    });
    openaiFileId = archivo.id;

    const vectorStoreFile = await config.client.vectorStores.files.createAndPoll(vectorStoreId, {
      file_id: archivo.id,
      // Derivados, nunca recibidos. El store ya es de esta cuenta, pero los
      // atributos son lo que separa a un agente de otro dentro de ella.
      attributes: atributosArchivo(s.identidad),
    });

    if (vectorStoreFile.status !== "completed") {
      // Quedó subido pero no indexable: se limpia para no pagar storage por un
      // archivo que nunca va a responder nada.
      await eliminarArchivo({ vectorStoreId, vectorStoreFileId: vectorStoreFile.id, openaiFileId });
      return {
        ok: false,
        motivo: vectorStoreFile.last_error?.message ?? `La indexación terminó en estado ${vectorStoreFile.status}`,
      };
    }

    return { ok: true, openaiFileId: archivo.id, vectorStoreFileId: vectorStoreFile.id, vectorStoreId };
  } catch (err) {
    console.error("[Documentacion] Falló la indexación:", err);

    // Si el File llegó a crearse pero el alta en el store no, hay que borrarlo:
    // si no, queda huérfano facturando storage y sin que nada lo referencie.
    if (openaiFileId) {
      await eliminarArchivo({ vectorStoreId: null, vectorStoreFileId: null, openaiFileId });
    }

    return { ok: false, motivo: mensajeDeError(err) };
  }
}

/**
 * Borrado real — FR-009.
 *
 * Dos pasos, y los dos importan: sacarlo del vector store lo vuelve
 * inconsultable, pero el archivo sigue existiendo en la cuenta de OpenAI
 * (ocupando y facturando). El pedido era borrarlo, no desindexarlo.
 */
export async function eliminarArchivo(
  ref: ReferenciaArchivo,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const config = obtenerConfiguracionDocumentacion();
  if (!config) return { ok: false, motivo: "La documentación no está habilitada en este entorno" };

  const fallos: string[] = [];

  if (ref.vectorStoreId && ref.vectorStoreFileId) {
    try {
      await config.client.vectorStores.files.delete(ref.vectorStoreFileId, {
        vector_store_id: ref.vectorStoreId,
      });
    } catch (err) {
      if (!esNoEncontrado(err)) fallos.push(`desindexar: ${mensajeDeError(err)}`);
    }
  }

  if (ref.openaiFileId) {
    try {
      await config.client.files.delete(ref.openaiFileId);
    } catch (err) {
      if (!esNoEncontrado(err)) fallos.push(`borrar el archivo: ${mensajeDeError(err)}`);
    }
  }

  if (fallos.length > 0) {
    console.error("[Documentacion] Borrado incompleto en OpenAI:", fallos.join(" · "));
    return { ok: false, motivo: fallos.join(" · ") };
  }

  return { ok: true };
}
