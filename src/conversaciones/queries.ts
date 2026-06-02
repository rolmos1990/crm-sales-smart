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
function mapearConversacion(conv: {
  id: string;
  instanciaId: string | null;
  contactoId: string;
  cuentaCanalId: string | null;
  asunto: string | null;
  estado: ConversacionResumen["estado"];
  clasificacion: ConversacionResumen["clasificacion"];
  oportunidadGanadaRel: ConversacionResumen["oportunidadGanadaRel"];
  creadoEn: Date;
  actualizadoEn: Date;
  contacto: {
    id: string;
    nombre: string;
    apellido: string;
    telefonoPrincipal: string | null;
    email: string | null;
    identificadoresCanal: { identificador: string; canal: string }[];
  };
  cuentaCanal: ConversacionResumen["cuentaCanal"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oportunidades: any[];
  mensajes: ConversacionResumen["ultimoMensaje"][];
  _count?: { mensajes: number };
}): ConversacionResumen {
  const canal = conv.cuentaCanal?.canal ?? "";
  const identificadorCanal =
    conv.contacto.identificadoresCanal.find((id) => id.canal === canal)?.identificador ?? null;

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
    oportunidades: conv.oportunidades.map((o) => ({
      ...o,
      oportunidad: { ...o.oportunidad, valor: Number(o.oportunidad.valor) },
    })),
    _count: conv._count,
    ultimoMensaje: (conv.mensajes[0] as MensajeConMeta | null) ?? null,
    identificadorCanal,
  };
}

export async function obtenerConversacionesPorOportunidad(
  oportunidadId: string
): Promise<ConversacionResumen[]> {
  const relPrincipal = await prisma.oportunidadContacto.findFirst({
    where: { oportunidadId, principal: true },
    select: { contactoId: true },
  });
  if (!relPrincipal) return [];

  const convs = await prisma.conversacion.findMany({
    where: { contactoId: relPrincipal.contactoId },
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

export async function obtenerConversacionesAbiertas(): Promise<ConversacionResumen[]> {
  const convs = await prisma.conversacion.findMany({
    where: { estado: { in: ["ABIERTA", "EN_ESPERA"] } },
    include: conversacionInclude,
    orderBy: { actualizadoEn: "desc" as const },
  });

  return convs.map(mapearConversacion);
}

// Carga el inbox completo: ABIERTA + EN_ESPERA + últimas 50 CERRADAS
export async function obtenerConversacionesInbox(): Promise<ConversacionResumen[]> {
  const [activas, cerradas] = await Promise.all([
    prisma.conversacion.findMany({
      where: { estado: { in: ["ABIERTA", "EN_ESPERA"] } },
      include: conversacionInclude,
      orderBy: { actualizadoEn: "desc" as const },
    }),
    prisma.conversacion.findMany({
      where: { estado: "CERRADA" },
      include: conversacionInclude,
      orderBy: { actualizadoEn: "desc" as const },
      take: 50,
    }),
  ]);

  return [...activas, ...cerradas].map(mapearConversacion);
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
