import { prisma } from "@/shared/db/prisma";

const incluirRelaciones = {
  contacto: { select: { id: true, nombre: true, apellido: true } },
  empresa: { select: { id: true, nombre: true } },
  oportunidad: { select: { id: true, titulo: true } },
} as const;

export async function obtenerActividades() {
  return prisma.actividad.findMany({
    include: incluirRelaciones,
    orderBy: { fecha: "desc" },
  });
}

export async function obtenerActividadesPorContacto(contactoId: string) {
  return prisma.actividad.findMany({
    where: { contactoId },
    include: incluirRelaciones,
    orderBy: { fecha: "desc" },
  });
}

export async function obtenerActividadesPorEmpresa(empresaId: string) {
  return prisma.actividad.findMany({
    where: { empresaId },
    include: incluirRelaciones,
    orderBy: { fecha: "desc" },
  });
}

export async function obtenerActividadesPorOportunidad(oportunidadId: string) {
  return prisma.actividad.findMany({
    where: { oportunidadId },
    include: incluirRelaciones,
    orderBy: { fecha: "desc" },
  });
}

export async function obtenerActividadesPendientes() {
  return prisma.actividad.findMany({
    where: { completada: false },
    include: incluirRelaciones,
    orderBy: { fecha: "asc" },
  });
}
