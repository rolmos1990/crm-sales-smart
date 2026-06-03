"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { normalizarTelefono } from "@/lib/normalizar-telefono";
import { CrearContactoSchema, ActualizarContactoSchema } from "./schema";
import type { ResultadoAccion, Contacto } from "./types";

const telNorm = (tel: string | undefined | null): string | null => {
  if (!tel) return null;
  const conPlus = tel.trimStart().startsWith("+");
  const digits = normalizarTelefono(tel);
  return digits ? (conPlus ? `+${digits}` : digits) : null;
};

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
        telefonoPrincipal: telNorm(telefonoPrincipal),
        telefonoSecundario: telNorm(telefonoSecundario),
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
        ...(telefonoPrincipal !== undefined && { telefonoPrincipal: telNorm(telefonoPrincipal) }),
        ...(telefonoSecundario !== undefined && { telefonoSecundario: telNorm(telefonoSecundario) }),
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

export async function buscarContactosAction(query: string) {
  if (!query.trim()) return [];
  const { buscarContactos } = await import("./queries");
  return buscarContactos(query);
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
    // Limpiar archivos del storage antes de borrar la BD (cascade DB elimina MediaArchivo)
    const mediasContacto = await prisma.mediaArchivo.findMany({
      where: { contactoId: id },
      select: { keyOptimizado: true, keyThumbnail: true, keyOriginal: true },
    });

    if (mediasContacto.length > 0) {
      const { getStorageProvider } = await import("@/lib/media/providers/factory");
      const provider = getStorageProvider();
      await Promise.allSettled(
        mediasContacto.flatMap((m) => [
          m.keyOptimizado ? provider.delete(m.keyOptimizado) : null,
          m.keyThumbnail  ? provider.delete(m.keyThumbnail)  : null,
          m.keyOriginal   ? provider.delete(m.keyOriginal)   : null,
        ].filter(Boolean) as Promise<void>[]
        )
      );
    }

    // Actividad, Cotizacion y Pedido no tienen onDelete definido en el schema
    // → hay que nullificar el FK antes de borrar para que PostgreSQL no bloquee
    await prisma.$transaction([
      prisma.actividad.updateMany({ where: { contactoId: id }, data: { contactoId: null } }),
      prisma.cotizacion.updateMany({ where: { contactoId: id }, data: { contactoId: null } }),
      prisma.pedido.updateMany({ where: { contactoId: id }, data: { contactoId: null } }),
      prisma.contacto.delete({ where: { id } }),
    ]);
    busEventos.publicar(TIPOS_EVENTO.CONTACTO_ELIMINADO, { contactoId: id });
    revalidatePath("/crm/contactos");
    return { exito: true, datos: undefined };
  } catch (e) {
    console.error("[eliminarContacto]", e);
    return { exito: false, error: "Error al eliminar el contacto" };
  }
}
