import { prisma } from "@/shared/db/prisma";

const incluirRelaciones = {
  contacto: { select: { id: true, nombre: true, apellido: true } },
  empresa: { select: { id: true, nombre: true } },
  oportunidad: { select: { id: true, titulo: true } },
  pedido: { select: { id: true, numero: true } },
  cotizacion: { select: { id: true, numero: true } },
  usuario: { select: { id: true, nombre: true } },
} as const;

export async function obtenerActividades(instanciaId: string) {
  return prisma.actividad.findMany({
    where: { instanciaId },
    include: incluirRelaciones,
    orderBy: { fecha: "desc" },
  });
}

export async function obtenerActividadesPorContacto(contactoId: string, instanciaId: string) {
  return prisma.actividad.findMany({
    where: { contactoId, instanciaId },
    include: incluirRelaciones,
    orderBy: { fecha: "desc" },
  });
}

export async function obtenerActividadesPorEmpresa(empresaId: string, instanciaId: string) {
  return prisma.actividad.findMany({
    where: { empresaId, instanciaId },
    include: incluirRelaciones,
    orderBy: { fecha: "desc" },
  });
}

export async function obtenerActividadesPorOportunidad(oportunidadId: string, instanciaId: string) {
  return prisma.actividad.findMany({
    where: { oportunidadId, instanciaId },
    include: incluirRelaciones,
    orderBy: { fecha: "desc" },
  });
}

export async function obtenerActividadesPendientes(instanciaId: string) {
  return prisma.actividad.findMany({
    where: { instanciaId, completada: false },
    include: incluirRelaciones,
    orderBy: { fecha: "asc" },
  });
}
