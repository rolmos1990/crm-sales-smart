// 035 — Lecturas de MensajeCorreo, SIEMPRE acotadas al comercio.
//
// Toda función recibe `instanciaId` y filtra por él en DOS lugares: en el
// propio MensajeCorreo y en la conversación del mensaje. Si cualquiera no
// coincide, devuelve null y quien llama responde 404 (FR-015). Las columnas
// Json se validan con Zod: un dato malformado se trata como ausente.
import { prisma } from "@/shared/db/prisma";
import {
  adjuntoCorreoSchema,
  direccionCorreoSchema,
  imagenesExternasSchema,
  type AdjuntoCorreo,
  type DireccionCorreo,
} from "./schema";

export type EstadoHtml = "SIN_HTML" | "DISPONIBLE" | "NO_DISPONIBLE";

export interface CorreoDeMensaje {
  mensajeId: string;
  instanciaId: string;
  estadoHtml: EstadoHtml;
  htmlLimpio: string | null;
  tieneImagenesExternas: boolean;
  imagenesExternas: string[];
  adjuntos: AdjuntoCorreo[];
  de: DireccionCorreo | null;
  para: DireccionCorreo[];
  paraTotal: number;
  cc: DireccionCorreo[];
  ccTotal: number;
  asunto: string | null;
  fechaEnvio: Date | null;
}

function listaSegura<T>(valor: unknown, esquema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): T[] {
  if (!Array.isArray(valor)) return [];
  const salida: T[] = [];
  for (const item of valor) {
    const r = esquema.safeParse(item);
    if (r.success && r.data !== undefined) salida.push(r.data);
  }
  return salida;
}

const SELECT_CORREO = {
  mensajeId: true,
  instanciaId: true,
  estadoHtml: true,
  htmlLimpio: true,
  tieneImagenesExternas: true,
  imagenesExternas: true,
  adjuntos: true,
  de: true,
  para: true,
  paraTotal: true,
  cc: true,
  ccTotal: true,
  asunto: true,
  fechaEnvio: true,
} as const;

type FilaCorreo = {
  mensajeId: string;
  instanciaId: string;
  estadoHtml: EstadoHtml;
  htmlLimpio: string | null;
  tieneImagenesExternas: boolean;
  imagenesExternas: unknown;
  adjuntos: unknown;
  de: unknown;
  para: unknown;
  paraTotal: number;
  cc: unknown;
  ccTotal: number;
  asunto: string | null;
  fechaEnvio: Date | null;
};

function aCorreo(fila: FilaCorreo): CorreoDeMensaje {
  const imagenes = imagenesExternasSchema.safeParse(fila.imagenesExternas);
  const de = direccionCorreoSchema.safeParse(fila.de);
  const htmlLimpio = fila.estadoHtml === "DISPONIBLE" ? fila.htmlLimpio : null;
  return {
    mensajeId: fila.mensajeId,
    instanciaId: fila.instanciaId,
    // Un DISPONIBLE sin HTML es un estado imposible; se trata como sin HTML.
    estadoHtml: fila.estadoHtml === "DISPONIBLE" && !htmlLimpio ? "SIN_HTML" : fila.estadoHtml,
    htmlLimpio,
    tieneImagenesExternas: imagenes.success && imagenes.data.length > 0,
    imagenesExternas: imagenes.success ? imagenes.data : [],
    adjuntos: listaSegura<AdjuntoCorreo>(fila.adjuntos, adjuntoCorreoSchema),
    de: de.success ? de.data : null,
    para: listaSegura<DireccionCorreo>(fila.para, direccionCorreoSchema),
    paraTotal: fila.paraTotal,
    cc: listaSegura<DireccionCorreo>(fila.cc, direccionCorreoSchema),
    ccTotal: fila.ccTotal,
    asunto: fila.asunto,
    fechaEnvio: fila.fechaEnvio,
  };
}

/** Datos de correo de un mensaje del comercio, o null. Lo usan las rutas con token. */
export async function obtenerCorreoDeMensaje(
  mensajeId: string,
  instanciaId: string,
): Promise<CorreoDeMensaje | null> {
  if (!mensajeId || !instanciaId) return null;
  const fila = await prisma.mensajeCorreo.findFirst({
    where: { mensajeId, instanciaId, mensaje: { conversacion: { instanciaId } } },
    select: SELECT_CORREO,
  });
  return fila ? aCorreo(fila as FilaCorreo) : null;
}

export interface MensajeCorreoParaSesion {
  mensajeId: string;
  /** Adjunto principal del mensaje (campos de media existentes). */
  mediaArchivoId: string | null;
  remitente: string;
  /** null = correo previo a 035 (o mensaje de otro canal): la UI deduce como hoy. */
  correo: CorreoDeMensaje | null;
}

/**
 * Mensaje del comercio de la sesión con sus datos de correo, o null si el
 * mensaje no existe o es de otro comercio. Lo usan las rutas con sesión.
 */
export async function obtenerMensajeCorreoParaSesion(
  mensajeId: string,
  instanciaId: string,
): Promise<MensajeCorreoParaSesion | null> {
  if (!mensajeId || !instanciaId) return null;
  const mensaje = await prisma.mensajeConversacion.findFirst({
    where: { id: mensajeId, conversacion: { instanciaId } },
    select: {
      id: true,
      mediaArchivoId: true,
      remitente: true,
      correo: { select: SELECT_CORREO },
    },
  });
  if (!mensaje) return null;
  const correo =
    mensaje.correo && mensaje.correo.instanciaId === instanciaId
      ? aCorreo(mensaje.correo as FilaCorreo)
      : null;
  return {
    mensajeId: mensaje.id,
    mediaArchivoId: mensaje.mediaArchivoId,
    remitente: mensaje.remitente,
    correo,
  };
}
