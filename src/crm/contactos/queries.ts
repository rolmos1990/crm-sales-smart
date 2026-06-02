import { prisma } from "@/shared/db/prisma";

export async function obtenerContactos() {
  return prisma.contacto.findMany({
    include: { empresa: { select: { id: true, nombre: true } } },
    orderBy: { creadoEn: "desc" },
  });
}

export async function obtenerContactoPorId(id: string) {
  return prisma.contacto.findUnique({
    where: { id },
    include: {
      empresa: { select: { id: true, nombre: true } },
      actividades: { orderBy: { fecha: "desc" }, take: 10 },
      oportunidades: {
        include: {
          oportunidad: {
            select: {
              id: true,
              titulo: true,
              etapa: true,
              valor: true,
              stage: { select: { esGanado: true, esPerdido: true, nombre: true, color: true } },
            },
          },
        },
      },
      tags: { include: { tag: true } },
    },
  });
}

export async function buscarContactos(query: string) {
  return prisma.contacto.findMany({
    where: {
      OR: [
        { nombre: { contains: query, mode: "insensitive" } },
        { apellido: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { telefonoPrincipal: { contains: query, mode: "insensitive" } },
        { telefonoSecundario: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      telefonoPrincipal: true,
      empresa: { select: { id: true, nombre: true } },
    },
    take: 10,
  });
}
