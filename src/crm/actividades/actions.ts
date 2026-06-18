"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { CrearActividadSchema, ActualizarActividadSchema } from "./schema";
import type { ResultadoAccion, Actividad } from "./types";

const incluirRelaciones = {
  contacto: { select: { id: true, nombre: true, apellido: true } },
  empresa: { select: { id: true, nombre: true } },
  oportunidad: { select: { id: true, titulo: true } },
  pedido: { select: { id: true, numero: true } },
  cotizacion: { select: { id: true, numero: true } },
  usuario: { select: { id: true, nombre: true } },
};

export async function crearActividad(datos: unknown): Promise<ResultadoAccion<Actividad>> {
  const validado = CrearActividadSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("actividades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const { contactoId, empresaId, oportunidadId, pedidoId, cotizacionId, descripcion, ...resto } = validado.data;
    const actividad = await prisma.actividad.create({
      data: {
        ...resto,
        instanciaId: sesion.instanciaId,
        descripcion: descripcion || null,
        contactoId: contactoId || null,
        empresaId: empresaId || null,
        oportunidadId: oportunidadId || null,
        pedidoId: pedidoId || null,
        cotizacionId: cotizacionId || null,
      },
      include: incluirRelaciones,
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

export async function actualizarActividad(id: string, datos: unknown): Promise<ResultadoAccion<Actividad>> {
  const validado = ActualizarActividadSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("actividades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const { contactoId, empresaId, oportunidadId, pedidoId, cotizacionId, descripcion, ...resto } = validado.data;
    const actividad = await prisma.actividad.update({
      where: { id },
      data: {
        ...resto,
        ...(descripcion !== undefined && { descripcion: descripcion || null }),
        ...(contactoId !== undefined && { contactoId: contactoId || null }),
        ...(empresaId !== undefined && { empresaId: empresaId || null }),
        ...(oportunidadId !== undefined && { oportunidadId: oportunidadId || null }),
        ...(pedidoId !== undefined && { pedidoId: pedidoId || null }),
        ...(cotizacionId !== undefined && { cotizacionId: cotizacionId || null }),
      },
      include: incluirRelaciones,
    });

    revalidatePath("/crm/actividades");
    return { exito: true, datos: actividad as unknown as Actividad };
  } catch {
    return { exito: false, error: "Error al actualizar la actividad" };
  }
}

export async function completarActividad(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("actividades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const completadaEn = new Date();
    await prisma.actividad.update({ where: { id }, data: { completada: true, completadaEn } });
    busEventos.publicar(TIPOS_EVENTO.ACTIVIDAD_COMPLETADA, { actividadId: id, completadaEn });
    revalidatePath("/crm/actividades");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al completar la actividad" };
  }
}

export async function eliminarActividad(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("actividades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    await prisma.actividad.delete({ where: { id } });
    revalidatePath("/crm/actividades");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la actividad" };
  }
}
