"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { CrearProductoSchema, ActualizarProductoSchema } from "./schema";
import type { ResultadoAccion, Producto } from "./types";

export async function crearProducto(datos: unknown): Promise<ResultadoAccion<Producto>> {
  const validado = CrearProductoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { descripcion, categoria, unidad, ...resto } = validado.data;
    const producto = await prisma.producto.create({
      data: {
        ...resto,
        moneda: resto.moneda ?? "PEN",
        activo: resto.activo ?? true,
        descripcion: descripcion || null,
        categoria: categoria || null,
        unidad: unidad || undefined,
      },
    });

    busEventos.publicar(TIPOS_EVENTO.PRODUCTO_CREADO, {
      productoId: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
    });
    revalidatePath("/productos");
    return { exito: true, datos: { ...producto, precio: Number(producto.precio) } as Producto };
  } catch {
    return { exito: false, error: "Error al crear el producto" };
  }
}

export async function actualizarProducto(id: string, datos: unknown): Promise<ResultadoAccion<Producto>> {
  const validado = ActualizarProductoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { descripcion, categoria, unidad, ...resto } = validado.data;
    const productoAntes = await prisma.producto.findUnique({ where: { id }, select: { precio: true } });
    const producto = await prisma.producto.update({
      where: { id },
      data: {
        ...resto,
        ...(descripcion !== undefined && { descripcion: descripcion || null }),
        ...(categoria !== undefined && { categoria: categoria || null }),
        ...(unidad !== undefined && { unidad: unidad || undefined }),
      },
    });

    if (productoAntes && validado.data.precio !== undefined && Number(productoAntes.precio) !== validado.data.precio) {
      busEventos.publicar(TIPOS_EVENTO.PRECIO_ACTUALIZADO, {
        productoId: id,
        precioAnterior: Number(productoAntes.precio),
        precioNuevo: validado.data.precio,
      });
    } else {
      busEventos.publicar(TIPOS_EVENTO.PRODUCTO_ACTUALIZADO, { productoId: id, cambios: validado.data as Record<string, unknown> });
    }

    revalidatePath("/productos");
    revalidatePath(`/productos/${id}`);
    return { exito: true, datos: { ...producto, precio: Number(producto.precio) } as Producto };
  } catch {
    return { exito: false, error: "Error al actualizar el producto" };
  }
}

export async function eliminarProducto(id: string): Promise<ResultadoAccion> {
  try {
    await prisma.producto.update({ where: { id }, data: { activo: false } });
    revalidatePath("/productos");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar el producto" };
  }
}
