"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { CrearContactoSchema, ActualizarContactoSchema } from "./schema";
import type { ResultadoAccion, Contacto } from "./types";

export async function crearContacto(datos: unknown): Promise<ResultadoAccion<Contacto>> {
  const validado = CrearContactoSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };
  }

  try {
    const { empresaId, email, telefonoPrincipal, telefonoSecundario, cargo, notas, tagIds, ...resto } = validado.data;
    const contacto = await prisma.contacto.create({
      data: {
        ...resto,
        email: email || null,
        telefonoPrincipal: telefonoPrincipal || null,
        telefonoSecundario: telefonoSecundario || null,
        cargo: cargo || null,
        notas: notas || null,
        empresaId: empresaId || null,
        ...(tagIds && tagIds.length > 0 && {
          tags: { createMany: { data: tagIds.map((tagId) => ({ tagId })) } },
        }),
      },
      include: { empresa: { select: { id: true, nombre: true } } },
    });

    busEventos.publicar(TIPOS_EVENTO.CONTACTO_CREADO, {
      contactoId: contacto.id,
      nombre: contacto.nombre,
      apellido: contacto.apellido,
      email: contacto.email ?? undefined,
      empresaId: contacto.empresaId ?? undefined,
    });

    revalidatePath("/crm/contactos");
    return { exito: true, datos: contacto as Contacto };
  } catch {
    return { exito: false, error: "Error al crear el contacto" };
  }
}

export async function actualizarContacto(id: string, datos: unknown): Promise<ResultadoAccion<Contacto>> {
  const validado = ActualizarContactoSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };
  }

  try {
    const { empresaId, email, telefonoPrincipal, telefonoSecundario, cargo, notas, tagIds, ...resto } = validado.data;
    const contacto = await prisma.contacto.update({
      where: { id },
      data: {
        ...resto,
        ...(email !== undefined && { email: email || null }),
        ...(telefonoPrincipal !== undefined && { telefonoPrincipal: telefonoPrincipal || null }),
        ...(telefonoSecundario !== undefined && { telefonoSecundario: telefonoSecundario || null }),
        ...(cargo !== undefined && { cargo: cargo || null }),
        ...(notas !== undefined && { notas: notas || null }),
        ...(empresaId !== undefined && { empresaId: empresaId || null }),
      },
      include: { empresa: { select: { id: true, nombre: true } } },
    });

    if (tagIds !== undefined) {
      await prisma.$transaction([
        prisma.contactoTag.deleteMany({ where: { contactoId: id } }),
        ...(tagIds.length > 0
          ? [prisma.contactoTag.createMany({ data: tagIds.map((tagId) => ({ contactoId: id, tagId })) })]
          : []),
      ]);
    }

    busEventos.publicar(TIPOS_EVENTO.CONTACTO_ACTUALIZADO, {
      contactoId: id,
      cambios: validado.data as Record<string, unknown>,
    });

    revalidatePath("/crm/contactos");
    revalidatePath(`/crm/contactos/${id}`);
    return { exito: true, datos: contacto as Contacto };
  } catch {
    return { exito: false, error: "Error al actualizar el contacto" };
  }
}

export async function obtenerContactoAction(id: string) {
  return prisma.contacto.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      telefonoPrincipal: true,
      telefonoSecundario: true,
      cargo: true,
      notas: true,
      estado: true,
    },
  });
}

export async function eliminarContacto(id: string): Promise<ResultadoAccion> {
  try {
    await prisma.contacto.delete({ where: { id } });
    busEventos.publicar(TIPOS_EVENTO.CONTACTO_ELIMINADO, { contactoId: id });
    revalidatePath("/crm/contactos");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar el contacto" };
  }
}
