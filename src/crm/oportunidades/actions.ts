"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { CrearOportunidadSchema, ActualizarOportunidadSchema, CambiarEtapaSchema } from "./schema";
import type { ResultadoAccion, Oportunidad } from "./types";
import { PROBABILIDADES_ETAPA } from "./types";

async function cerrarConversacionesDeOportunidad(oportunidadId: string) {
  const links = await prisma.oportunidadConversacion.findMany({
    where: { oportunidadId },
    select: { conversacionId: true },
  });
  const ids = links.map((l) => l.conversacionId);
  if (ids.length === 0) return;
  await prisma.conversacion.updateMany({
    where: { id: { in: ids }, estado: { not: "CERRADA" } },
    data: { estado: "CERRADA" },
  });
}

export async function crearOportunidad(datos: unknown): Promise<ResultadoAccion<Oportunidad>> {
  const validado = CrearOportunidadSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("oportunidades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const { empresaId, contactoId, notas, pipelineId, stageId, probabilidad: _prob, tagIds, ...resto } = validado.data;

    let probabilidad: number;
    if (stageId) {
      const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId }, select: { probabilidad: true } });
      probabilidad = stage?.probabilidad ?? 20;
    } else {
      probabilidad = PROBABILIDADES_ETAPA[(resto.etapa ?? "PROSPECTO")];
    }

    const oportunidad = await prisma.oportunidad.create({
      data: {
        ...resto,
        instanciaId: sesion.instanciaId,
        probabilidad,
        notas: notas || null,
        empresaId: empresaId || null,
        pipelineId: pipelineId || null,
        stageId: stageId || null,
        ...(contactoId && {
          contactos: { create: { contactoId } },
        }),
        ...(tagIds && tagIds.length > 0 && {
          tags: { createMany: { data: tagIds.map((tagId) => ({ tagId })) } },
        }),
      },
      include: {
        empresa: { select: { id: true, nombre: true } },
        contactos: { include: { contacto: { select: { id: true, nombre: true, apellido: true } } } },
      },
    });

    await publicadorEventos.publicar(EventosSistema.OportunidadCreada, sesion.instanciaId, {
      instanciaId: sesion.instanciaId,
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

  const auth = await requirePermisoAction("oportunidades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const actual = await prisma.oportunidad.findFirst({ where: { id, instanciaId: sesion.instanciaId }, select: { etapa: true } });
    if (!actual) return { exito: false, error: "Oportunidad no encontrada" };

    await prisma.oportunidad.update({
      where: { id },
      data: {
        etapa: validado.data.etapa,
        probabilidad: PROBABILIDADES_ETAPA[validado.data.etapa],
        motivoPerdida: validado.data.motivoPerdida || null,
      },
    });

    await publicadorEventos.publicar(EventosSistema.EtapaCambiada, sesion.instanciaId, {
      instanciaId: sesion.instanciaId,
      oportunidadId: id,
      etapaAnterior: actual.etapa,
      etapaNueva: validado.data.etapa,
    });

    if (validado.data.etapa === "GANADO") {
      await publicadorEventos.publicar(EventosSistema.OportunidadGanada, sesion.instanciaId, { instanciaId: sesion.instanciaId, oportunidadId: id, valor: 0 });
      await cerrarConversacionesDeOportunidad(id);
    } else if (validado.data.etapa === "PERDIDO") {
      await publicadorEventos.publicar(EventosSistema.OportunidadPerdida, sesion.instanciaId, { instanciaId: sesion.instanciaId, oportunidadId: id, motivo: validado.data.motivoPerdida });
      await cerrarConversacionesDeOportunidad(id);
    }

    revalidatePath("/crm/oportunidades");
    revalidatePath("/crm/pipeline");
    revalidatePath("/crm/inbox");
    revalidatePath(`/crm/oportunidades/${id}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al cambiar la etapa" };
  }
}

export async function actualizarOportunidad(id: string, datos: unknown): Promise<ResultadoAccion<Oportunidad>> {
  const validado = ActualizarOportunidadSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("oportunidades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const existe = await prisma.oportunidad.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
    if (!existe) return { exito: false, error: "Oportunidad no encontrada" };

    const { empresaId, contactoId: _, notas, probabilidad: _prob, tagIds, pipelineId, stageId, ...resto } = validado.data;
    const oportunidad = await prisma.oportunidad.update({
      where: { id },
      data: {
        ...resto,
        ...(notas !== undefined && { notas: notas || null }),
        ...(empresaId !== undefined && { empresaId: empresaId || null }),
        ...(pipelineId !== undefined && { pipelineId: pipelineId || null }),
        ...(stageId !== undefined && { stageId: stageId || null }),
      },
      include: { empresa: { select: { id: true, nombre: true } }, contactos: { include: { contacto: { select: { id: true, nombre: true, apellido: true } } } } },
    });

    if (tagIds !== undefined) {
      await prisma.$transaction([
        prisma.oportunidadTag.deleteMany({ where: { oportunidadId: id } }),
        ...(tagIds.length > 0
          ? [prisma.oportunidadTag.createMany({ data: tagIds.map((tagId) => ({ oportunidadId: id, tagId })) })]
          : []),
      ]);
    }

    await publicadorEventos.publicar(EventosSistema.OportunidadActualizada, sesion.instanciaId, { instanciaId: sesion.instanciaId, oportunidadId: id, cambios: validado.data as Record<string, unknown> });
    revalidatePath("/crm/oportunidades");
    revalidatePath(`/crm/oportunidades/${id}`);
    return { exito: true, datos: { ...oportunidad, valor: Number(oportunidad.valor) } as unknown as Oportunidad };
  } catch {
    return { exito: false, error: "Error al actualizar la oportunidad" };
  }
}

export async function obtenerOportunidadAction(id: string) {
  const sesion = await requireSesion();
  return prisma.oportunidad.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
    select: {
      id: true,
      titulo: true,
      valor: true,
      moneda: true,
      etapa: true,
      probabilidad: true,
      fechaCierre: true,
      notas: true,
      motivoPerdida: true,
      creadoEn: true,
      actualizadoEn: true,
      empresaId: true,
      usuarioId: true,
      stageId: true,
      pipelineId: true,
      metadata: true,
      empresa: { select: { id: true, nombre: true } },
      contactos: {
        include: {
          contacto: {
            select: {
              id: true, nombre: true, apellido: true,
              email: true, telefonoPrincipal: true, telefonoSecundario: true,
              cargo: true, estado: true, notas: true,
            },
          },
        },
        orderBy: { principal: "desc" },
      },
      tags: { include: { tag: { select: { id: true, nombre: true, color: true } } } },
    },
  });
}

export async function obtenerContactosDeOportunidadAction(oportunidadId: string) {
  const sesion = await requireSesion();
  const oportunidad = await prisma.oportunidad.findFirst({
    where: { id: oportunidadId, instanciaId: sesion.instanciaId },
    select: {
      contactos: {
        include: {
          contacto: {
            select: {
              id: true, nombre: true, apellido: true,
              email: true, telefonoPrincipal: true, telefonoSecundario: true,
              cargo: true, estado: true, notas: true,
            },
          },
        },
        orderBy: { principal: "desc" },
      },
    },
  });

  return (oportunidad?.contactos ?? []).map((rel) => ({
    contactoId: rel.contactoId,
    principal: rel.principal,
    contacto: rel.contacto,
  }));
}

export async function agregarContactoAOportunidad(
  oportunidadId: string,
  contactoId: string,
): Promise<ResultadoAccion<void>> {
  const auth = await requirePermisoAction("oportunidades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const count = await prisma.oportunidadContacto.count({ where: { oportunidadId } });
    await prisma.oportunidadContacto.upsert({
      where: { oportunidadId_contactoId: { oportunidadId, contactoId } },
      create: { oportunidadId, contactoId, principal: count === 0 },
      update: {},
    });
    revalidatePath("/crm/oportunidades");
    revalidatePath(`/crm/oportunidades/${oportunidadId}`);
    revalidatePath("/crm/pipeline");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al agregar el contacto" };
  }
}

export async function removerContactoDeOportunidad(
  oportunidadId: string,
  contactoId: string,
): Promise<ResultadoAccion<void>> {
  const auth = await requirePermisoAction("oportunidades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const eliminado = await prisma.oportunidadContacto.delete({
      where: { oportunidadId_contactoId: { oportunidadId, contactoId } },
    });
    if (eliminado.principal) {
      const otro = await prisma.oportunidadContacto.findFirst({ where: { oportunidadId } });
      if (otro) {
        await prisma.oportunidadContacto.update({
          where: { oportunidadId_contactoId: { oportunidadId, contactoId: otro.contactoId } },
          data: { principal: true },
        });
      }
    }
    revalidatePath("/crm/oportunidades");
    revalidatePath(`/crm/oportunidades/${oportunidadId}`);
    revalidatePath("/crm/pipeline");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al remover el contacto" };
  }
}

export async function marcarContactoPrincipal(
  oportunidadId: string,
  contactoId: string,
): Promise<ResultadoAccion<void>> {
  const auth = await requirePermisoAction("oportunidades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    await prisma.$transaction([
      prisma.oportunidadContacto.updateMany({ where: { oportunidadId }, data: { principal: false } }),
      prisma.oportunidadContacto.update({
        where: { oportunidadId_contactoId: { oportunidadId, contactoId } },
        data: { principal: true },
      }),
    ]);
    revalidatePath("/crm/oportunidades");
    revalidatePath(`/crm/oportunidades/${oportunidadId}`);
    revalidatePath("/crm/pipeline");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al marcar como principal" };
  }
}

export async function asignarContactoAOportunidad(
  oportunidadId: string,
  contactoId: string | null,
): Promise<ResultadoAccion<void>> {
  const auth = await requirePermisoAction("oportunidades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.oportunidadContacto.deleteMany({ where: { oportunidadId } });
      if (contactoId) {
        await tx.oportunidadContacto.create({
          data: { oportunidadId, contactoId, principal: true },
        });
      }
    });
    revalidatePath("/crm/oportunidades");
    revalidatePath(`/crm/oportunidades/${oportunidadId}`);
    revalidatePath("/crm/pipeline");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al asignar el contacto" };
  }
}

export async function actualizarMetadataOportunidad(
  id: string,
  metadata: Record<string, unknown>,
): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("oportunidades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const existe = await prisma.oportunidad.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
    if (!existe) return { exito: false, error: "Oportunidad no encontrada" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.oportunidad.update({ where: { id }, data: { metadata: metadata as any } });
    revalidatePath("/crm/pipeline");
    revalidatePath(`/crm/oportunidades/${id}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al guardar los campos personalizados" };
  }
}

export async function eliminarOportunidad(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("oportunidades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const existe = await prisma.oportunidad.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
    if (!existe) return { exito: false, error: "Oportunidad no encontrada" };

    await prisma.oportunidad.delete({ where: { id } });
    revalidatePath("/crm/oportunidades");
    revalidatePath("/crm/pipeline");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la oportunidad" };
  }
}

export async function marcarMensajeLeido(id: string): Promise<void> {
  try {
    await prisma.oportunidad.update({
      where: { id },
      data: { nuevoMensaje: false },
    });
    revalidatePath("/crm/pipeline");
  } catch { /* ignorar — no crítico */ }
}
