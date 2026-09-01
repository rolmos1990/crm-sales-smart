import { prisma } from "@/shared/db/prisma";

// Fuente para el selector de "Marcar como piloto" — no depende de InboxLayout
// (componente cliente central del Inbox, deliberadamente no modificado por
// esta spec para no arriesgar su comportamiento existente).
export async function listarConversacionesRecientes(instanciaId: string, limite = 50) {
  return prisma.conversacion.findMany({
    where: { instanciaId },
    orderBy: { actualizadoEn: "desc" },
    take: limite,
    select: {
      id: true,
      asunto: true,
      contacto: { select: { nombre: true, apellido: true } },
      actualizadoEn: true,
    },
  });
}

export async function listarConversacionesPiloto(instanciaId: string) {
  return prisma.conversacionPiloto.findMany({
    where: { instanciaId },
    orderBy: { creadoEn: "desc" },
    include: {
      conversacionOrigen: { select: { id: true, contacto: { select: { id: true, nombre: true, apellido: true } } } },
      producto: { select: { id: true, nombre: true } },
      playbookEstrategia: { select: { id: true, nombre: true } },
    },
  });
}

export async function obtenerConversacionPiloto(id: string, instanciaId: string) {
  return prisma.conversacionPiloto.findFirst({
    where: { id, instanciaId },
    include: {
      conversacionOrigen: { select: { id: true, contactoId: true } },
    },
  });
}

export async function listarRecomendaciones(instanciaId: string, agenteIAConfigId?: string) {
  return prisma.recomendacionComportamiento.findMany({
    where: { instanciaId, ...(agenteIAConfigId ? { agenteIAConfigId } : {}) },
    orderBy: { creadoEn: "desc" },
  });
}

export async function listarRecomendacionesRechazadas(instanciaId: string, agenteIAConfigId?: string) {
  return prisma.recomendacionComportamiento.findMany({
    where: { instanciaId, estado: "RECHAZADA", ...(agenteIAConfigId ? { agenteIAConfigId } : {}) },
    select: { reglaSugerida: true },
  });
}

export async function listarEjemplosPrompt(instanciaId: string) {
  return prisma.ejemploPrompt.findMany({
    where: { instanciaId },
    orderBy: { creadoEn: "desc" },
  });
}
