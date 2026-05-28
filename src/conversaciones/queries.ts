import { prisma } from "@/shared/db/prisma";
import type { ConversacionResumen, MensajeConMeta } from "./types";

export async function obtenerConversacionesPorOportunidad(
  oportunidadId: string
): Promise<ConversacionResumen[]> {
  const rels = await prisma.oportunidadConversacion.findMany({
    where: { oportunidadId },
    include: {
      conversacion: {
        include: {
          contacto: { select: { id: true, nombre: true, apellido: true, telefonoPrincipal: true, email: true } },
          cuentaCanal: { select: { id: true, canal: true, nombre: true, identificador: true } },
          oportunidades: true,
          mensajes: {
            orderBy: { creadoEn: "desc" as const },
            take: 1,
          },
          _count: { select: { mensajes: true } },
        },
      },
    },
    orderBy: { creadoEn: "desc" as const },
  });

  return rels.map((r) => {
    const conv = r.conversacion;
    return {
      id: conv.id,
      instanciaId: conv.instanciaId,
      contactoId: conv.contactoId,
      cuentaCanalId: conv.cuentaCanalId,
      asunto: conv.asunto,
      estado: conv.estado,
      creadoEn: conv.creadoEn,
      actualizadoEn: conv.actualizadoEn,
      contacto: conv.contacto,
      cuentaCanal: conv.cuentaCanal,
      oportunidades: conv.oportunidades,
      _count: conv._count,
      ultimoMensaje: conv.mensajes[0] as MensajeConMeta | null ?? null,
    };
  });
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

export async function obtenerConversacionesContacto(contactoId: string) {
  return prisma.conversacion.findMany({
    where: { contactoId },
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
  contactoId: string
): Promise<ConversacionResumen[]> {
  const convs = await prisma.conversacion.findMany({
    where: { contactoId },
    include: {
      contacto: { select: { id: true, nombre: true, apellido: true, telefonoPrincipal: true, email: true } },
      cuentaCanal: { select: { id: true, canal: true, nombre: true, identificador: true } },
      oportunidades: true,
      mensajes: {
        orderBy: { creadoEn: "desc" as const },
        take: 1,
      },
      _count: { select: { mensajes: true } },
    },
    orderBy: { actualizadoEn: "desc" as const },
  });

  return convs.map((conv) => ({
    id: conv.id,
    instanciaId: conv.instanciaId,
    contactoId: conv.contactoId,
    cuentaCanalId: conv.cuentaCanalId,
    asunto: conv.asunto,
    estado: conv.estado,
    creadoEn: conv.creadoEn,
    actualizadoEn: conv.actualizadoEn,
    contacto: conv.contacto,
    cuentaCanal: conv.cuentaCanal,
    oportunidades: conv.oportunidades,
    _count: conv._count,
    ultimoMensaje: conv.mensajes[0] as MensajeConMeta | null ?? null,
  }));
}

export async function buscarIdentificadorCanal(canal: string, identificador: string, instanciaId: string) {
  return prisma.contactoIdentificadorCanal.findUnique({
    where: { canal_identificador_instanciaId: { canal, identificador, instanciaId } },
    include: { contacto: true },
  });
}

export async function obtenerConversacionesAbiertas(): Promise<ConversacionResumen[]> {
  const convs = await prisma.conversacion.findMany({
    where: { estado: { in: ["ABIERTA", "EN_ESPERA"] } },
    include: {
      contacto: { select: { id: true, nombre: true, apellido: true, telefonoPrincipal: true, email: true } },
      cuentaCanal: { select: { id: true, canal: true, nombre: true, identificador: true } },
      oportunidades: true,
      mensajes: {
        orderBy: { creadoEn: "desc" as const },
        take: 1,
      },
      _count: { select: { mensajes: true } },
    },
    orderBy: { actualizadoEn: "desc" as const },
  });

  return convs.map((conv) => ({
    id: conv.id,
    instanciaId: conv.instanciaId,
    contactoId: conv.contactoId,
    cuentaCanalId: conv.cuentaCanalId,
    asunto: conv.asunto,
    estado: conv.estado,
    creadoEn: conv.creadoEn,
    actualizadoEn: conv.actualizadoEn,
    contacto: conv.contacto,
    cuentaCanal: conv.cuentaCanal,
    oportunidades: conv.oportunidades,
    _count: conv._count,
    ultimoMensaje: conv.mensajes[0] as MensajeConMeta | null ?? null,
  }));
}

export async function obtenerUltimosMensajes(conversacionId: string, limite = 50): Promise<MensajeConMeta[]> {
  const mensajes = await prisma.mensajeConversacion.findMany({
    where: { conversacionId },
    orderBy: { creadoEn: "desc" as const },
    take: limite,
  });
  return mensajes.reverse() as MensajeConMeta[];
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
    orderBy: { creadoEn: "desc" as const },
    take: limite,
  });
  return mensajes.reverse() as MensajeConMeta[];
}

export async function obtenerTodasLasConversaciones(): Promise<ConversacionResumen[]> {
  const convs = await prisma.conversacion.findMany({
    include: {
      contacto: { select: { id: true, nombre: true, apellido: true, telefonoPrincipal: true, email: true } },
      cuentaCanal: { select: { id: true, canal: true, nombre: true, identificador: true } },
      oportunidades: true,
      mensajes: {
        orderBy: { creadoEn: "desc" as const },
        take: 1,
      },
      _count: { select: { mensajes: true } },
    },
    orderBy: { actualizadoEn: "desc" as const },
  });

  return convs.map((conv) => ({
    id: conv.id,
    instanciaId: conv.instanciaId,
    contactoId: conv.contactoId,
    cuentaCanalId: conv.cuentaCanalId,
    asunto: conv.asunto,
    estado: conv.estado,
    creadoEn: conv.creadoEn,
    actualizadoEn: conv.actualizadoEn,
    contacto: conv.contacto,
    cuentaCanal: conv.cuentaCanal,
    oportunidades: conv.oportunidades,
    _count: conv._count,
    ultimoMensaje: conv.mensajes[0] as MensajeConMeta | null ?? null,
  }));
}
