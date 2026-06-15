"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { CrearActividadSchema, ActualizarActividadSchema } from "./schema";
import type { ResultadoAccion, Actividad } from "./types";

export async function crearActividad(datos: unknown): Promise<ResultadoAccion<Actividad>> {
  const validado = CrearActividadSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const sesion = await requireSesion();
    const { contactoId, empresaId, oportunidadId, descripcion, ...resto } = validado.data;
    const actividad = await prisma.actividad.create({
      data: {
        ...resto,
        instanciaId: sesion.instanciaId,
        descripcion: descripcion || null,
        contactoId: contactoId || null,
        empresaId: empresaId || null,
        oportunidadId: oportunidadId || null,
      },
      include: {
        contacto: { select: { id: true, nombre: true, apellido: true } },
        empresa: { select: { id: true, nombre: true } },
        oportunidad: { select: { id: true, titulo: true } },
      },
    });

    busEventos.publicar(TIPOS_EVENTO.ACTIVIDAD_CREADA, {
      actividadId: actividad.id,
      tipo: actividad.tipo,
      fecha: actividad.fecha,
      entidadId: contactoId || empresaId || oportunidadId || undefined,
      entidadTipo: contactoId ? "contacto" : empresaId ? "empresa" : oportunidadId ? "oportunidad" : undefined,
    });

    revalidatePath("/crm/actividades");
    if (contactoId) revalidatePath(`/crm/contactos/${contactoId}`);
    if (empresaId) revalidatePath(`/crm/empresas/${empresaId}`);
    if (oportunidadId) revalidatePath(`/crm/oportunidades/${oportunidadId}`);
    return { exito: true, datos: actividad as unknown as Actividad };
  } catch {
    return { exito: false, error: "Error al crear la actividad" };
  }
}

export async function completarActividad(id: string): Promise<ResultadoAccion> {
  try {
    const completadaEn = new Date();
    await prisma.actividad.update({
      where: { id },
      data: { completada: true, completadaEn },
    });

    busEventos.publicar(TIPOS_EVENTO.ACTIVIDAD_COMPLETADA, { actividadId: id, completadaEn });
    revalidatePath("/crm/actividades");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al completar la actividad" };
  }
}

export async function eliminarActividad(id: string): Promise<ResultadoAccion> {
  try {
    await prisma.actividad.delete({ where: { id } });
    revalidatePath("/crm/actividades");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la actividad" };
  }
}
