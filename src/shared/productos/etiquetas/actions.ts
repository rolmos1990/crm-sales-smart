"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { CrearEtiquetaProductoSchema, ActualizarEtiquetaProductoSchema } from "./schema";
import type { ResultadoAccion } from "../types";
import type { EtiquetaProducto } from "./types";

function errorDeGuardado(e: unknown, porDefecto: string): string {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
    ? "Ya existe una etiqueta con ese nombre"
    : porDefecto;
}

function revalidar() {
  revalidatePath("/productos");
}

export async function crearEtiquetaProducto(datos: unknown): Promise<ResultadoAccion<EtiquetaProducto>> {
  const auth = await requirePermisoAction("productos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const validado = CrearEtiquetaProductoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const etiqueta = await prisma.etiquetaProducto.create({
      data: { nombre: validado.data.nombre, color: validado.data.color || null, instanciaId: auth.sesion.instanciaId },
      select: { id: true, nombre: true, color: true },
    });
    revalidar();
    return { exito: true, datos: { ...etiqueta, totalProductos: 0 } };
  } catch (e) {
    return { exito: false, error: errorDeGuardado(e, "Error al crear la etiqueta") };
  }
}

export async function actualizarEtiquetaProducto(id: string, datos: unknown): Promise<ResultadoAccion<EtiquetaProducto>> {
  const auth = await requirePermisoAction("productos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const validado = ActualizarEtiquetaProductoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const etiqueta = await prisma.etiquetaProducto.update({
      where: { id, instanciaId: auth.sesion.instanciaId },
      data: {
        ...(validado.data.nombre !== undefined && { nombre: validado.data.nombre }),
        ...(validado.data.color !== undefined && { color: validado.data.color || null }),
      },
      select: { id: true, nombre: true, color: true, _count: { select: { productos: true } } },
    });
    revalidar();
    const { _count, ...resto } = etiqueta;
    return { exito: true, datos: { ...resto, totalProductos: _count.productos } };
  } catch (e) {
    return { exito: false, error: errorDeGuardado(e, "Error al actualizar la etiqueta") };
  }
}

/** Borra la etiqueta y la quita de todos sus productos (cascade); los productos no cambian. */
export async function eliminarEtiquetaProducto(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("productos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    await prisma.etiquetaProducto.delete({ where: { id, instanciaId: auth.sesion.instanciaId } });
    revalidar();
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la etiqueta" };
  }
}
