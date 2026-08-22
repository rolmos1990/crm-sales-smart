import { prisma } from "@/shared/db/prisma";
import { ocultarCodigo } from "@/shared/lib/codigo-sensible";
import type { ProductoCatalogo } from "./types";

// Campos de ProductoEntregaDigital que sí pueden llegar al cliente — nunca
// `codigo` crudo (ver ocultarCodigo, aplicado siempre antes del `return`).
const SELECT_ENTREGA_DIGITAL = {
  metodo: true, url: true, archivo: true, codigo: true, usuarioAcceso: true,
  instrucciones: true, observaciones: true, requiereSeguimiento: true, tipoSeguimiento: true,
} as const;

export async function obtenerProductos(instanciaId: string) {
  return prisma.producto.findMany({
    where: { instanciaId, activo: true },
    orderBy: { nombre: "asc" },
  });
}

export async function obtenerProductoPorId(id: string, instanciaId: string) {
  const producto = await prisma.producto.findFirst({
    where: { id, instanciaId },
    include: { entregaDigital: { select: SELECT_ENTREGA_DIGITAL } },
  });
  if (!producto) return null;
  const { entregaDigital, ...resto } = producto;
  return { ...resto, entregaDigital: ocultarCodigo(entregaDigital) };
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
      select: {
        id: true, sku: true, nombre: true, precio: true, moneda: true, unidad: true, imagenUrl: true,
        manejaStock: true, cantidadDisponible: true, tipo: true,
        entregaDigital: { select: SELECT_ENTREGA_DIGITAL },
      },
      orderBy: { nombre: "asc" },
    });
    return datos.map((p) => {
      const { entregaDigital, ...resto } = p;
      return {
        ...resto,
        precio: Number(p.precio),
        cantidadDisponible: Number(p.cantidadDisponible),
        entregaDigital: ocultarCodigo(entregaDigital),
      };
    });
  } catch {
    return [];
  }
}
