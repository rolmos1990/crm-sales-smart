import { prisma } from "@/shared/db/prisma";

export async function obtenerTags() {
  return prisma.tag.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });
}

export async function obtenerTagPorId(id: string) {
  return prisma.tag.findUnique({ where: { id } });
}
