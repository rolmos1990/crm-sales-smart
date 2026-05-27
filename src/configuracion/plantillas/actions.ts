"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { CrearPlantillaSchema, ActualizarPlantillaSchema, normalizarAlias } from "./schema";
import type { ResultadoAccion, Plantilla } from "./types";

export async function crearPlantilla(datos: unknown): Promise<ResultadoAccion<Plantilla>> {
  const validado = CrearPlantillaSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };
  }

  try {
    const plantilla = await prisma.plantillaCRM.create({
      data: {
        nombre: validado.data.nombre,
        alias: normalizarAlias(validado.data.alias),
        descripcion: validado.data.descripcion || null,
        tipo: validado.data.tipo,
        contenidoTexto: validado.data.contenidoTexto,
        imagenUrl: validado.data.imagenUrl || null,
        instanciaId: validado.data.instanciaId,
      },
    });
    revalidatePath("/configuracion");
    return { exito: true, datos: plantilla as Plantilla };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { exito: false, error: "Ya existe una plantilla con ese alias" };
    }
    return { exito: false, error: "Error al crear la plantilla" };
  }
}

export async function actualizarPlantilla(
  id: string,
  datos: unknown
): Promise<ResultadoAccion<Plantilla>> {
  const validado = ActualizarPlantillaSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };
  }

  try {
    const plantilla = await prisma.plantillaCRM.update({
      where: { id },
      data: {
        ...validado.data,
        alias: validado.data.alias ? normalizarAlias(validado.data.alias) : undefined,
        descripcion: validado.data.descripcion || null,
        imagenUrl: validado.data.imagenUrl || null,
      },
    });
    revalidatePath("/configuracion");
    return { exito: true, datos: plantilla as Plantilla };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { exito: false, error: "Ya existe una plantilla con ese alias" };
    }
    return { exito: false, error: "Error al actualizar la plantilla" };
  }
}

export async function togglePlantillaActiva(
  id: string,
  activo: boolean
): Promise<ResultadoAccion> {
  try {
    await prisma.plantillaCRM.update({ where: { id }, data: { activo } });
    revalidatePath("/configuracion");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al actualizar el estado" };
  }
}

export async function eliminarPlantilla(id: string): Promise<ResultadoAccion> {
  try {
    await prisma.plantillaCRM.delete({ where: { id } });
    revalidatePath("/configuracion");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la plantilla" };
  }
}
