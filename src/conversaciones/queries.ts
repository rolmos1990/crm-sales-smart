import { prisma } from "@/shared/db/prisma";
import type { ConversacionResumen, MensajeConMeta } from "./types";

// Selección de contacto con identificadores de canal incluidos
const contactoSelect = {
  id: true,
  nombre: true,
  apellido: true,
  telefonoPrincipal: true,
  email: true,
  identificadoresCanal: {
    select: { identificador: true, canal: true },
  },
} as const;

const oportunidadGanadaRelSelect = {
  id: true,
  titulo: true,
  fechaGanada: true,
  etapa: true,
} as const;

// Include compartido para todas las queries de inbox
const conversacionInclude = {
  contacto: { select: contactoSelect },
  cuentaCanal: { select: { id: true, canal: true, nombre: true, identificador: true } },
  oportunidades: {
    include: {
      oportunidad: {
        select: {
          id: true,
          titulo: true,
          etapa: true,
          valor: true,
          moneda: true,
          stage: { select: { esGanado: true, esPerdido: true, nombre: true, color: true } },
        },
      },
    },
  },
  oportunidadGanadaRel: { select: oportunidadGanadaRelSelect },
  mensajes: { orderBy: { creadoEn: "desc" as const }, take: 1 },
  _count: { select: { mensajes: true } },
} as const;

// Mapea una conversación Prisma a ConversacionResumen incluyendo el identificador de canal
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearConversacion(conv: any): ConversacionResumen {
  const canal = conv.cuentaCanal?.canal ?? "";
  const identificadorCanal =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conv.contacto.identificadoresCanal.find((id: any) => id.canal === canal)?.identificador ?? null;

  return {
    id: conv.id,
    instanciaId: conv.instanciaId,
    contactoId: conv.contactoId,
    cuentaCanalId: conv.cuentaCanalId,
    asunto: conv.asunto,
    estado: conv.estado,
    clasificacion: conv.clasificacion,
    oportunidadGanadaRel: conv.oportunidadGanadaRel,
    creadoEn: conv.creadoEn,
    actualizadoEn: conv.actualizadoEn,
    contacto: {
      id: conv.contacto.id,
      nombre: conv.contacto.nombre,
      apellido: conv.contacto.apellido,
      telefonoPrincipal: conv.contacto.telefonoPrincipal,
      email: conv.contacto.email,
    },
    cuentaCanal: conv.cuentaCanal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oportunidades: conv.oportunidades.map((o: any) => ({
      ...o,
      oportunidad: { ...o.oportunidad, valor: Number(o.oportunidad.valor) },
    })),
    _count: conv._count,
    ultimoMensaje: (conv.mensajes[0] as MensajeConMeta | null) ?? null,
    identificadorCanal,
  };
}

export async function obtenerConversacionesPorOportunidad(
  oportunidadId: string,
  instanciaId: string
): Promise<ConversacionResumen[]> {
  const relPrincipal = await prisma.oportunidadContacto.findFirst({
    where: { oportunidadId, principal: true },
    select: { contactoId: true },
  });
  if (!relPrincipal) return [];

  const convs = await prisma.conversacion.findMany({
    where: { contactoId: relPrincipal.contactoId, instanciaId },
    include: conversacionInclude,
    orderBy: { actualizadoEn: "desc" as const },
  });

  return convs.map(mapearConversacion);
}

export async function obtenerMensajesConversacion(
  conversacionId: string,
  limite = 50,
  cursor?: string
): Promise<MensajeConMeta[]> {
  const mensajes = await prisma.mensajeConversacion.findMany({
    where: { conversacionId },
    orderBy: { creadoEn: "asc" as const },
    take: limite,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return mensajes as MensajeConMeta[];
}

export async function obtenerCuentasCanal(instanciaId: string) {
  return prisma.cuentaCanal.findMany({
    where: { instanciaId, activa: true },
    orderBy: { nombre: "asc" as const },
    select: { id: true, canal: true, nombre: true, identificador: true, instanciaId: true },
  });
}

export async function obtenerTodasLasCuentasCanal() {
  return prisma.cuentaCanal.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" as const },
    select: { id: true, canal: true, nombre: true, identificador: true, instanciaId: true },
  });
}

export async function obtenerConversacionesContacto(contactoId: string, instanciaId: string) {
  return prisma.conversacion.findMany({
    where: { contactoId, instanciaId },
    include: {
      cuentaCanal: { select: { id: true, canal: true, nombre: true } },
      _count: { select: { mensajes: true } },
      mensajes: {
        orderBy: { creadoEn: "desc" as const },
        take: 30,
      },
    },
    orderBy: { actualizadoEn: "desc" as const },
  });
}

export async function obtenerConversacionesResumenPorContacto(
  contactoId: string,
  instanciaId: string
): Promise<ConversacionResumen[]> {
  const convs = await prisma.conversacion.findMany({
    where: { contactoId, instanciaId },
    include: conversacionInclude,
    orderBy: { actualizadoEn: "desc" as const },
  });

  return convs.map(mapearConversacion);
}

export async function buscarIdentificadorCanal(canal: string, identificador: string, instanciaId: string) {
  return prisma.contactoIdentificadorCanal.findUnique({
    where: { canal_identificador_instanciaId: { canal, identificador, instanciaId } },
    include: { contacto: true },
  });
}

export async function obtenerConversacionesAbiertas(instanciaId: string): Promise<ConversacionResumen[]> {
  const convs = await prisma.conversacion.findMany({
    where: { instanciaId, estado: { in: ["ABIERTA", "EN_ESPERA"] } },
    include: conversacionInclude,
    orderBy: { actualizadoEn: "desc" as const },
  });

  return convs.map(mapearConversacion);
}

// Carga el inbox completo: ABIERTA + EN_ESPERA + últimas 50 CERRADAS
export async function obtenerConversacionesInbox(instanciaId: string): Promise<ConversacionResumen[]> {
  const [activas, cerradas] = await Promise.all([
    prisma.conversacion.findMany({
      where: { instanciaId, estado: { in: ["ABIERTA", "EN_ESPERA"] } },
      include: conversacionInclude,
      orderBy: { actualizadoEn: "desc" as const },
    }),
    prisma.conversacion.findMany({
      where: { instanciaId, estado: "CERRADA" },
      include: conversacionInclude,
      orderBy: { actualizadoEn: "desc" as const },
      take: 50,
    }),
  ]);

  return [...activas, ...cerradas].map(mapearConversacion);
}

const mensajeInclude = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reacciones: { orderBy: { creadoEn: "asc" } },
  mediaArchivo: {
    select: {
      id: true,
      urlOptimizada: true,
      urlThumbnail: true,
      estadoProcesado: true,
      errorMensaje: true,
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

function mapearMensaje(m: unknown): MensajeConMeta {
  const raw = m as Record<string, unknown> & { mediaArchivo?: { id: string; urlOptimizada: string; urlThumbnail: string | null; estadoProcesado: string; errorMensaje: string | null } | null };
  const ma = raw.mediaArchivo;
  return {
    ...(raw as unknown as MensajeConMeta),
    mediaArchivoId: ma?.id ?? null,
    mediaEstado: (ma?.estadoProcesado as MensajeConMeta["mediaEstado"]) ?? null,
    mediaUrlOptimizada: ma?.urlOptimizada ?? null,
    mediaUrlThumbnail: ma?.urlThumbnail ?? null,
    mediaErrorMensaje: ma?.errorMensaje ?? null,
  };
}

export async function obtenerUltimosMensajes(conversacionId: string, limite = 50): Promise<MensajeConMeta[]> {
  const mensajes = await prisma.mensajeConversacion.findMany({
    where: { conversacionId },
    include: mensajeInclude,
    orderBy: { creadoEn: "desc" as const },
    take: limite,
  });
  return mensajes.reverse().map(mapearMensaje);
}

export async function obtenerMensajesAnteriores(
  conversacionId: string,
  antesDeId: string,
  limite = 50
): Promise<MensajeConMeta[]> {
  const ref = await prisma.mensajeConversacion.findUnique({ where: { id: antesDeId } });
  if (!ref) return [];
  const mensajes = await prisma.mensajeConversacion.findMany({
    where: { conversacionId, creadoEn: { lt: ref.creadoEn } },
    include: mensajeInclude,
    orderBy: { creadoEn: "desc" as const },
    take: limite,
  });
  return mensajes.reverse().map(mapearMensaje);
}

export async function obtenerTodasLasConversaciones(instanciaId: string): Promise<ConversacionResumen[]> {
  const convs = await prisma.conversacion.findMany({
    where: { instanciaId },
    include: conversacionInclude,
    orderBy: { actualizadoEn: "desc" as const },
  });

  return convs.map(mapearConversacion);
}

export async function obtenerConversacionPorId(conversacionId: string): Promise<ConversacionResumen | null> {
  const conv = await prisma.conversacion.findUnique({
    where: { id: conversacionId },
    include: conversacionInclude,
  });
  if (!conv) return null;
  return mapearConversacion(conv);
}
