"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { CrearOportunidadSchema, ActualizarOportunidadSchema, CambiarEtapaSchema } from "./schema";
import type { ResultadoAccion, Oportunidad } from "./types";

export async function crearOportunidad(datos: unknown): Promise<ResultadoAccion<Oportunidad>> {
  const validado = CrearOportunidadSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { empresaId, contactoId, notas, ...resto } = validado.data;
    const oportunidad = await prisma.oportunidad.create({
      data: {
        ...resto,
        notas: notas || null,
        empresaId: empresaId || null,
        ...(contactoId && {
          contactos: { create: { contactoId } },
        }),
      },
      include: {
        empresa: { select: { id: true, nombre: true } },
        contactos: { include: { contacto: { select: { id: true, nombre: true, apellido: true } } } },
      },
    });

    busEventos.publicar(TIPOS_EVENTO.OPORTUNIDAD_CREADA, {
      oportunidadId: oportunidad.id,
      titulo: oportunidad.titulo,
      valor: Number(oportunidad.valor),
      empresaId: oportunidad.empresaId ?? undefined,
    });

    revalidatePath("/crm/oportunidades");
    revalidatePath("/crm/pipeline");
    return { exito: true, datos: { ...oportunidad, valor: Number(oportunidad.valor) } as unknown as Oportunidad };
  } catch {
    return { exito: false, error: "Error al crear la oportunidad" };
  }
}

export async function cambiarEtapa(id: string, datos: unknown): Promise<ResultadoAccion> {
  const validado = CambiarEtapaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const actual = await prisma.oportunidad.findUnique({ where: { id }, select: { etapa: true } });
    if (!actual) return { exito: false, error: "Oportunidad no encontrada" };

    await prisma.oportunidad.update({
      where: { id },
      data: {
        etapa: validado.data.etapa,
        motivoPerdida: validado.data.motivoPerdida || null,
      },
    });

    busEventos.publicar(TIPOS_EVENTO.ETAPA_CAMBIADA, {
      oportunidadId: id,
      etapaAnterior: actual.etapa,
      etapaNueva: validado.data.etapa,
    });

    if (validado.data.etapa === "GANADO") {
      busEventos.publicar(TIPOS_EVENTO.OPORTUNIDAD_GANADA, { oportunidadId: id, valor: 0 });
    } else if (validado.data.etapa === "PERDIDO") {
      busEventos.publicar(TIPOS_EVENTO.OPORTUNIDAD_PERDIDA, { oportunidadId: id, motivo: validado.data.motivoPerdida });
    }

    revalidatePath("/crm/oportunidades");
    revalidatePath("/crm/pipeline");
    revalidatePath(`/crm/oportunidades/${id}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al cambiar la etapa" };
  }
}

export async function actualizarOportunidad(id: string, datos: unknown): Promise<ResultadoAccion<Oportunidad>> {
  const validado = ActualizarOportunidadSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { empresaId, contactoId: _, notas, ...resto } = validado.data;
    const oportunidad = await prisma.oportunidad.update({
      where: { id },
      data: {
        ...resto,
        ...(notas !== undefined && { notas: notas || null }),
        ...(empresaId !== undefined && { empresaId: empresaId || null }),
      },
      include: { empresa: { select: { id: true, nombre: true } }, contactos: { include: { contacto: { select: { id: true, nombre: true, apellido: true } } } } },
    });

    busEventos.publicar(TIPOS_EVENTO.OPORTUNIDAD_ACTUALIZADA, { oportunidadId: id, cambios: validado.data as Record<string, unknown> });
    revalidatePath("/crm/oportunidades");
    revalidatePath(`/crm/oportunidades/${id}`);
    return { exito: true, datos: { ...oportunidad, valor: Number(oportunidad.valor) } as unknown as Oportunidad };
  } catch {
    return { exito: false, error: "Error al actualizar la oportunidad" };
  }
}

export async function eliminarOportunidad(id: string): Promise<ResultadoAccion> {
  try {
    await prisma.oportunidad.delete({ where: { id } });
    revalidatePath("/crm/oportunidades");
    revalidatePath("/crm/pipeline");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la oportunidad" };
  }
}
