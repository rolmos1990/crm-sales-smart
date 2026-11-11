"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
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

const ERROR_NO_ENCONTRADO = "Disparador no encontrado";

// Los ids llegan desde el cliente: sin este filtro por instancia, un usuario
// podría modificar disparadores de otra empresa conociendo un id. Se acepta
// también vía stage porque `pipelineId` es opcional en el modelo.
function filtroInstancia(instanciaId: string) {
  return {
    OR: [{ pipeline: { instanciaId } }, { stage: { pipeline: { instanciaId } } }],
  };
}

async function disparadorDeInstancia(id: string, instanciaId: string) {
  return prisma.disparador.findFirst({
    where: { id, ...filtroInstancia(instanciaId) },
    select: { id: true },
  });
}

export async function crearDisparador(
  pipelineId: string,
  stageId: string,
  datos: unknown
) {
  const parsed = SchemaDisparador.safeParse(datos);
  if (!parsed.success)
    return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("pipeline", "modificar");
  if (!auth.ok) return { exito: false as const, error: auth.error };

  try {
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, pipeline: { instanciaId: auth.sesion.instanciaId } },
      select: { id: true },
    });
    if (!stage) return { exito: false as const, error: "Etapa no encontrada" };

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

  const auth = await requirePermisoAction("pipeline", "modificar");
  if (!auth.ok) return { exito: false as const, error: auth.error };

  try {
    if (!(await disparadorDeInstancia(id, auth.sesion.instanciaId)))
      return { exito: false as const, error: ERROR_NO_ENCONTRADO };

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
  const auth = await requirePermisoAction("pipeline", "modificar");
  if (!auth.ok) return { exito: false as const, error: auth.error };

  try {
    if (!(await disparadorDeInstancia(id, auth.sesion.instanciaId)))
      return { exito: false as const, error: ERROR_NO_ENCONTRADO };

    await prisma.disparador.update({ where: { id }, data: { activo } });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al cambiar estado" };
  }
}

export async function eliminarDisparador(id: string) {
  const auth = await requirePermisoAction("pipeline", "modificar");
  if (!auth.ok) return { exito: false as const, error: auth.error };

  try {
    if (!(await disparadorDeInstancia(id, auth.sesion.instanciaId)))
      return { exito: false as const, error: ERROR_NO_ENCONTRADO };

    await prisma.disparador.update({ where: { id }, data: { activo: false } });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al eliminar el disparador" };
  }
}

export async function reordenarDisparadores(stageId: string, ids: string[]) {
  const auth = await requirePermisoAction("pipeline", "modificar");
  if (!auth.ok) return { exito: false as const, error: auth.error };

  try {
    const propios = await prisma.disparador.count({
      where: { id: { in: ids }, stageId, ...filtroInstancia(auth.sesion.instanciaId) },
    });
    if (propios !== new Set(ids).size) return { exito: false as const, error: ERROR_NO_ENCONTRADO };

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
