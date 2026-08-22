import { prisma } from "@/shared/db/prisma";
import type { ProductoCatalogo } from "./types";

export async function obtenerProductos(instanciaId: string) {
  return prisma.producto.findMany({
    where: { instanciaId, activo: true },
    orderBy: { nombre: "asc" },
  });
}

export async function obtenerProductoPorId(id: string, instanciaId: string) {
  return prisma.producto.findFirst({ where: { id, instanciaId } });
}

export async function buscarProductos(query: string, instanciaId: string) {
  return prisma.producto.findMany({
    where: {
      instanciaId,
      activo: true,
      OR: [
        { nombre: { contains: query, mode: "insensitive" } },
        { categoria: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, sku: true, nombre: true, precio: true, moneda: true, unidad: true, imagenUrl: true, manejaStock: true, cantidadDisponible: true, tipo: true },
    take: 20,
  });
}

export async function obtenerProductosCatalogo(instanciaId: string): Promise<ProductoCatalogo[]> {
  try {
    const datos = await prisma.producto.findMany({
      where: { instanciaId, activo: true },
      select: { id: true, sku: true, nombre: true, precio: true, moneda: true, unidad: true, imagenUrl: true, manejaStock: true, cantidadDisponible: true, tipo: true },
      orderBy: { nombre: "asc" },
    });
    return datos.map((p) => ({ ...p, precio: Number(p.precio), cantidadDisponible: Number(p.cantidadDisponible) }));
  } catch {
    return [];
  }
}
