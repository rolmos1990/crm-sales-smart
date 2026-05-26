"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { CrearTagSchema, ActualizarTagSchema } from "./schema";
import type { ResultadoAccion, Tag } from "./types";

export async function crearTag(datos: unknown): Promise<ResultadoAccion<Tag>> {
  const validado = CrearTagSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const tag = await prisma.tag.create({
      data: {
        nombre: validado.data.nombre,
        color: validado.data.color || null,
      },
    });
    revalidatePath("/crm/etiquetas");
    return { exito: true, datos: tag as Tag };
  } catch {
    return { exito: false, error: "Error al crear la etiqueta" };
  }
}

export async function actualizarTag(id: string, datos: unknown): Promise<ResultadoAccion<Tag>> {
  const validado = ActualizarTagSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const tag = await prisma.tag.update({
      where: { id },
      data: {
        ...(validado.data.nombre !== undefined && { nombre: validado.data.nombre }),
        ...(validado.data.color !== undefined && { color: validado.data.color || null }),
      },
    });
    revalidatePath("/crm/etiquetas");
    return { exito: true, datos: tag as Tag };
  } catch {
    return { exito: false, error: "Error al actualizar la etiqueta" };
  }
}

export async function eliminarTag(id: string): Promise<ResultadoAccion> {
  try {
    await prisma.tag.update({ where: { id }, data: { activo: false } });
    revalidatePath("/crm/etiquetas");
    revalidatePath("/crm/oportunidades");
    revalidatePath("/crm/contactos");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la etiqueta" };
  }
}

export async function asignarTagsOportunidad(oportunidadId: string, tagIds: string[]): Promise<ResultadoAccion> {
  try {
    await prisma.$transaction([
      prisma.oportunidadTag.deleteMany({ where: { oportunidadId } }),
      ...(tagIds.length > 0
        ? [prisma.oportunidadTag.createMany({
            data: tagIds.map((tagId) => ({ oportunidadId, tagId })),
          })]
        : []),
    ]);
    revalidatePath("/crm/oportunidades");
    revalidatePath(`/crm/oportunidades/${oportunidadId}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al asignar etiquetas" };
  }
}

export async function asignarTagsContacto(contactoId: string, tagIds: string[]): Promise<ResultadoAccion> {
  try {
    await prisma.$transaction([
      prisma.contactoTag.deleteMany({ where: { contactoId } }),
      ...(tagIds.length > 0
        ? [prisma.contactoTag.createMany({
            data: tagIds.map((tagId) => ({ contactoId, tagId })),
          })]
        : []),
    ]);
    revalidatePath("/crm/contactos");
    revalidatePath(`/crm/contactos/${contactoId}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al asignar etiquetas" };
  }
}
