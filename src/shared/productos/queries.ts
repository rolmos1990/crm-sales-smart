import { prisma } from "@/shared/db/prisma";
import type { ProductoCatalogo } from "./types";

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
        { sku: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, sku: true, nombre: true, precio: true, moneda: true, unidad: true, imagenUrl: true, manejaStock: true, cantidadDisponible: true },
    take: 20,
  });
}

export async function obtenerProductosCatalogo(): Promise<ProductoCatalogo[]> {
  try {
    const datos = await prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, sku: true, nombre: true, precio: true, moneda: true, unidad: true, imagenUrl: true, manejaStock: true, cantidadDisponible: true },
      orderBy: { nombre: "asc" },
    });
    return datos.map((p) => ({ ...p, precio: Number(p.precio), cantidadDisponible: Number(p.cantidadDisponible) }));
  } catch {
    return [];
  }
}
