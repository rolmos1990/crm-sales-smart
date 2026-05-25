import { prisma } from "@/shared/db/prisma";

export async function obtenerProductos() {
  return prisma.producto.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });
}

export async function obtenerProductoPorId(id: string) {
  return prisma.producto.findUnique({ where: { id } });
}

export async function buscarProductos(query: string) {
  return prisma.producto.findMany({
    where: {
      activo: true,
      OR: [
        { nombre: { contains: query, mode: "insensitive" } },
        { categoria: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, nombre: true, precio: true, moneda: true, unidad: true },
    take: 20,
  });
}
