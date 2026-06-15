import { prisma } from "@/shared/db/prisma";

export async function obtenerEmpresas(instanciaId: string) {
  return prisma.empresa.findMany({
    where: { instanciaId, activo: true },
    include: {
      _count: { select: { contactos: true, oportunidades: true, actividades: true } },
    },
    orderBy: { nombre: "asc" },
  });
}

export async function obtenerEmpresaPorId(id: string, instanciaId: string) {
  return prisma.empresa.findFirst({
    where: { id, instanciaId },
    include: {
      contactos: { include: { empresa: { select: { id: true, nombre: true } } }, take: 10 },
      oportunidades: { orderBy: { creadoEn: "desc" }, take: 10 },
      actividades: { orderBy: { fecha: "desc" }, take: 10 },
      _count: { select: { contactos: true, oportunidades: true } },
    },
  });
}

export async function buscarEmpresas(query: string, instanciaId: string) {
  return prisma.empresa.findMany({
    where: {
      instanciaId,
      activo: true,
      OR: [
        { nombre: { contains: query, mode: "insensitive" } },
        { ruc: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, nombre: true },
    take: 10,
  });
}
