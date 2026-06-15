import { prisma } from "@/shared/db/prisma";

export async function obtenerTags(instanciaId: string) {
  return prisma.tag.findMany({
    where: { instanciaId, activo: true },
    orderBy: { nombre: "asc" },
  });
}

export async function obtenerTagPorId(id: string, instanciaId: string) {
  return prisma.tag.findFirst({ where: { id, instanciaId } });
}
