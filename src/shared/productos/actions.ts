"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { CrearProductoSchema, ActualizarProductoSchema } from "./schema";
import type { ResultadoAccion, Producto } from "./types";

export async function crearProducto(datos: unknown): Promise<ResultadoAccion<Producto>> {
  const auth = await requirePermisoAction("productos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const sesion = auth.sesion;
  const validado = CrearProductoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { descripcion, categoria, unidad, sku, imagenUrl, manejaStock, cantidadDisponible, ...resto } = validado.data;
    const producto = await prisma.producto.create({
      data: {
        ...resto,
        instanciaId: sesion.instanciaId,
        moneda: resto.moneda ?? "PEN",
        activo: resto.activo ?? true,
        descripcion: descripcion || null,
        categoria: categoria || null,
        unidad: unidad || undefined,
        sku: sku || null,
        imagenUrl: imagenUrl || null,
        manejaStock: manejaStock ?? false,
        cantidadDisponible: cantidadDisponible ?? 0,
      },
    });

    await publicadorEventos.publicar(EventosSistema.ProductoCreado, sesion.instanciaId, {
      instanciaId: sesion.instanciaId,
      productoId: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
    });
    revalidatePath("/productos");
    return { exito: true, datos: { ...producto, precio: Number(producto.precio), cantidadDisponible: Number(producto.cantidadDisponible) } as Producto };
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes("Unique constraint") && e.message.includes("sku")
      ? "Ya existe un producto con ese SKU"
      : "Error al crear el producto";
    return { exito: false, error: msg };
  }
}

export async function actualizarProducto(id: string, datos: unknown): Promise<ResultadoAccion<Producto>> {
  const auth = await requirePermisoAction("productos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const sesion = auth.sesion;
  const validado = ActualizarProductoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { descripcion, categoria, unidad, sku, imagenUrl, manejaStock, cantidadDisponible, ...resto } = validado.data;
    const productoAntes = await prisma.producto.findUnique({ where: { id, instanciaId: sesion.instanciaId }, select: { precio: true } });
    const producto = await prisma.producto.update({
      where: { id, instanciaId: sesion.instanciaId },
      data: {
        ...resto,
        ...(descripcion !== undefined && { descripcion: descripcion || null }),
        ...(categoria !== undefined && { categoria: categoria || null }),
        ...(unidad !== undefined && { unidad: unidad || undefined }),
        ...(sku !== undefined && { sku: sku || null }),
        ...(imagenUrl !== undefined && { imagenUrl: imagenUrl || null }),
        ...(manejaStock !== undefined && { manejaStock }),
        ...(cantidadDisponible !== undefined && { cantidadDisponible }),
      },
    });

    if (productoAntes && validado.data.precio !== undefined && Number(productoAntes.precio) !== validado.data.precio) {
      await publicadorEventos.publicar(EventosSistema.PrecioActualizado, sesion.instanciaId, {
        instanciaId: sesion.instanciaId,
        productoId: id,
        precioAnterior: Number(productoAntes.precio),
        precioNuevo: validado.data.precio,
      });
    } else {
      await publicadorEventos.publicar(EventosSistema.ProductoActualizado, sesion.instanciaId, { instanciaId: sesion.instanciaId, productoId: id, cambios: validado.data as Record<string, unknown> });
    }

    revalidatePath("/productos");
    revalidatePath(`/productos/${id}`);
    return { exito: true, datos: { ...producto, precio: Number(producto.precio), cantidadDisponible: Number(producto.cantidadDisponible) } as Producto };
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes("Unique constraint") && e.message.includes("sku")
      ? "Ya existe un producto con ese SKU"
      : "Error al actualizar el producto";
    return { exito: false, error: msg };
  }
}

export async function eliminarProducto(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("productos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const sesion = auth.sesion;
  try {
    await prisma.producto.update({ where: { id, instanciaId: sesion.instanciaId }, data: { activo: false } });
    revalidatePath("/productos");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar el producto" };
  }
}
