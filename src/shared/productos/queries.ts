import { prisma } from "@/shared/db/prisma";
import { ocultarCodigo } from "@/shared/lib/codigo-sensible";
import { calcularDisponibilidadCombo } from "./inventario";
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
    include: {
      entregaDigital: { select: SELECT_ENTREGA_DIGITAL },
      componentes: { select: { componenteId: true, cantidad: true }, orderBy: { creadoEn: "asc" } },
      variantes: {
        select: { id: true, valores: true, sku: true, precio: true, cantidadDisponible: true, activo: true },
        orderBy: { orden: "asc" },
      },
    },
  });
  if (!producto) return null;
  const { entregaDigital, componentes, variantes, ...resto } = producto;
  return {
    ...resto,
    entregaDigital: ocultarCodigo(entregaDigital),
    componentes: componentes.map((c) => ({ productoId: c.componenteId, cantidad: c.cantidad })),
    variantes: variantes.map((v) => ({
      id: v.id,
      valores: (v.valores ?? {}) as Record<string, string>,
      sku: v.sku ?? "",
      precio: v.precio === null ? null : Number(v.precio),
      cantidadDisponible: Number(v.cantidadDisponible),
      activo: v.activo,
    })),
  };
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
        // 029 — todos los activos, también los que no son de venta directa:
        // el selector los oculta de las opciones pero necesita resolver el
        // nombre de una línea ya guardada con uno de ellos.
        esCombo: true,
        ventaDirecta: true,
        componentes: {
          select: {
            cantidad: true,
            componente: { select: { manejaStock: true, cantidadDisponible: true, activo: true } },
          },
        },
        // 030 — todas (también inactivas) para resolver el nombre de líneas
        // ya guardadas; el selector solo ofrece las activas.
        tieneVariantes: true,
        variantes: {
          select: { id: true, nombre: true, sku: true, precio: true, cantidadDisponible: true, activo: true },
          orderBy: { orden: "asc" },
        },
      },
      orderBy: { nombre: "asc" },
    });
    return datos.map((p) => {
      const { entregaDigital, componentes, variantes, ...resto } = p;
      const variantesCatalogo = variantes.map((v) => ({
        id: v.id,
        nombre: v.nombre,
        sku: v.sku,
        precio: v.precio === null ? Number(p.precio) : Number(v.precio),
        disponibilidad: p.manejaStock ? Math.max(0, Number(v.cantidadDisponible)) : null,
        activo: v.activo,
      }));
      return {
        ...resto,
        precio: Number(p.precio),
        cantidadDisponible: Number(p.cantidadDisponible),
        entregaDigital: ocultarCodigo(entregaDigital),
        variantes: variantesCatalogo,
        // Con variantes, el total es la suma de las activas: nunca un stock propio.
        disponibilidad: p.tieneVariantes
          ? p.manejaStock
            ? variantesCatalogo.filter((v) => v.activo).reduce((acc, v) => acc + (v.disponibilidad ?? 0), 0)
            : null
          : p.esCombo
          ? calcularDisponibilidadCombo(
              componentes.map((c) => ({
                cantidad: c.cantidad,
                manejaStock: c.componente.manejaStock,
                cantidadDisponible: Number(c.componente.cantidadDisponible),
                activo: c.componente.activo,
              })),
            )
          : p.manejaStock
            ? Math.max(0, Number(p.cantidadDisponible))
            : null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * 029-combos-productos-compuestos — productos que pueden ser componentes de
 * un combo: activos, de la instancia, que no son combos. Incluye los que no
 * son de venta directa (es justamente el caso típico de un componente).
 */
export async function obtenerProductosParaComponentes(instanciaId: string, excluirId?: string) {
  const datos = await prisma.producto.findMany({
    // 030 — un producto con variantes todavía no puede ser componente (habría
    // que elegir de qué variante descontar).
    where: { instanciaId, activo: true, esCombo: false, tieneVariantes: false, ...(excluirId && { id: { not: excluirId } }) },
    select: { id: true, nombre: true, sku: true, precio: true, moneda: true, unidad: true, manejaStock: true, cantidadDisponible: true },
    orderBy: { nombre: "asc" },
  });
  return datos.map((p) => ({ ...p, precio: Number(p.precio), cantidadDisponible: Number(p.cantidadDisponible) }));
}

export type ProductoParaComponente = Awaited<ReturnType<typeof obtenerProductosParaComponentes>>[number];
