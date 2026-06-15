"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { SchemaDisparador } from "./schema";
import { obtenerDisparadoresPorPipeline } from "./queries";
import type { Disparador, DisparadorJob } from "./types";

export async function obtenerTagsParaDisparadorAction() {
  const sesion = await requireSesion();
  return prisma.tag.findMany({
    where: { instanciaId: sesion.instanciaId, activo: true },
    select: { id: true, nombre: true, color: true },
    orderBy: { nombre: "asc" },
  });
}

export async function obtenerPipelinesParaDisparadorAction() {
  const sesion = await requireSesion();
  return prisma.pipeline.findMany({
    where: { instanciaId: sesion.instanciaId, activo: true },
    include: {
      stages: {
        select: { id: true, nombre: true, color: true, orden: true },
        orderBy: { orden: "asc" },
      },
    },
    orderBy: { nombre: "asc" },
  });
}

export async function obtenerDisparadoresAction(
  pipelineId: string
): Promise<(Disparador & { jobs: Pick<DisparadorJob, "id" | "estado" | "ejecutarEn" | "creadoEn">[] })[]> {
  const sesion = await requireSesion();
  return obtenerDisparadoresPorPipeline(pipelineId, sesion.instanciaId);
}

export async function crearDisparador(
  pipelineId: string,
  stageId: string,
  datos: unknown
) {
  const parsed = SchemaDisparador.safeParse(datos);
  if (!parsed.success)
    return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const last = await prisma.disparador.findFirst({
      where: { stageId, activo: true },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });

    const d = await prisma.disparador.create({
      data: {
        nombre: parsed.data.nombre,
        activo: parsed.data.activo,
        delayMinutos: parsed.data.delayMinutos ?? null,
        tipo: parsed.data.tipo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: parsed.data.config as any,
        orden: (last?.orden ?? -1) + 1,
        stageId,
        pipelineId,
      },
    });
    revalidatePath("/crm/pipeline");
    return { exito: true as const, id: d.id };
  } catch {
    return { exito: false as const, error: "Error al crear el disparador" };
  }
}

export async function actualizarDisparador(id: string, datos: unknown) {
  const parsed = SchemaDisparador.safeParse(datos);
  if (!parsed.success)
    return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    await prisma.disparador.update({
      where: { id },
      data: {
        nombre: parsed.data.nombre,
        activo: parsed.data.activo,
        delayMinutos: parsed.data.delayMinutos ?? null,
        tipo: parsed.data.tipo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: parsed.data.config as any,
      },
    });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al actualizar el disparador" };
  }
}

export async function toggleDisparador(id: string, activo: boolean) {
  try {
    await prisma.disparador.update({ where: { id }, data: { activo } });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al cambiar estado" };
  }
}

export async function eliminarDisparador(id: string) {
  try {
    await prisma.disparador.update({ where: { id }, data: { activo: false } });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al eliminar el disparador" };
  }
}

export async function reordenarDisparadores(stageId: string, ids: string[]) {
  try {
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.disparador.update({ where: { id }, data: { orden: index } })
      )
    );
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al reordenar" };
  }
}
