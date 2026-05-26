"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { SchemaPipeline, SchemaStage, SchemaCampoPersonalizado } from "./schema";
import { obtenerPipelines } from "./queries";

export async function obtenerPipelinesAction() {
  return obtenerPipelines();
}

const STAGES_INICIALES = [
  { nombre: "Prospecto",   orden: 0, probabilidad: 20, esInicial: true,  color: "#818cf8" },
  { nombre: "Calificado",  orden: 1, probabilidad: 40,                   color: "#c084fc" },
  { nombre: "Propuesta",   orden: 2, probabilidad: 60,                   color: "#fbbf24" },
  { nombre: "Negociación", orden: 3, probabilidad: 80,                   color: "#f97316" },
  { nombre: "Ganado",      orden: 4, probabilidad: 100, esGanado: true,  color: "#4ade80" },
  { nombre: "Perdido",     orden: 5, probabilidad: 0,   esPerdido: true, color: "#f87171" },
];

export async function crearPipeline(datos: unknown) {
  const parsed = SchemaPipeline.safeParse(datos);
  if (!parsed.success) return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const pipeline = await prisma.pipeline.create({
      data: {
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion ?? null,
        stages: { create: STAGES_INICIALES },
      },
    });
    revalidatePath("/crm/pipeline");
    return { exito: true as const, id: pipeline.id };
  } catch {
    return { exito: false as const, error: "Error al crear el pipeline" };
  }
}

export async function actualizarNombrePipeline(id: string, datos: unknown) {
  const parsed = SchemaPipeline.safeParse(datos);
  if (!parsed.success) return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    await prisma.pipeline.update({
      where: { id },
      data: { nombre: parsed.data.nombre, descripcion: parsed.data.descripcion ?? null },
    });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al actualizar" };
  }
}

export async function eliminarPipeline(id: string) {
  try {
    await prisma.pipeline.update({ where: { id }, data: { activo: false } });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al eliminar" };
  }
}

export async function crearStage(pipelineId: string, datos: unknown) {
  const parsed = SchemaStage.safeParse(datos);
  if (!parsed.success) return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const last = await prisma.pipelineStage.findFirst({
      where: { pipelineId, activo: true },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });
    const stage = await prisma.pipelineStage.create({
      data: { ...parsed.data, color: parsed.data.color ?? null, pipelineId, orden: (last?.orden ?? -1) + 1 },
    });
    revalidatePath("/crm/pipeline");
    return { exito: true as const, id: stage.id };
  } catch {
    return { exito: false as const, error: "Error al crear la etapa" };
  }
}

export async function actualizarStage(id: string, datos: unknown) {
  const parsed = SchemaStage.partial().safeParse(datos);
  if (!parsed.success) return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    await prisma.pipelineStage.update({
      where: { id },
      data: { ...parsed.data, ...(parsed.data.color !== undefined && { color: parsed.data.color ?? null }) },
    });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al actualizar la etapa" };
  }
}

export async function eliminarStage(id: string) {
  try {
    await prisma.pipelineStage.update({ where: { id }, data: { activo: false } });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al eliminar la etapa" };
  }
}

export async function reordenarStages(pipelineId: string, stageIds: string[]) {
  try {
    await prisma.$transaction(
      stageIds.map((id, index) =>
        prisma.pipelineStage.update({ where: { id }, data: { orden: index } })
      )
    );
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al reordenar" };
  }
}

export async function moverAStage(oportunidadId: string, stageId: string, pipelineId: string) {
  try {
    const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId }, select: { probabilidad: true } });
    await prisma.oportunidad.update({
      where: { id: oportunidadId },
      data: {
        stageId,
        pipelineId,
        ...(stage != null && { probabilidad: stage.probabilidad }),
      },
    });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al mover la oportunidad" };
  }
}

// ── Campos personalizados por stage ──────────────────────────────

export async function crearCampoStage(pipelineId: string, stageId: string, datos: unknown) {
  const parsed = SchemaCampoPersonalizado.safeParse(datos);
  if (!parsed.success) return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const last = await prisma.campoPersonalizado.findFirst({
      where: { stageId, activo: true },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });
    const campo = await prisma.campoPersonalizado.create({
      data: {
        nombre: parsed.data.nombre,
        clave: parsed.data.clave,
        tipo: parsed.data.tipo as never,
        entidad: "OPORTUNIDAD",
        requerido: parsed.data.requerido,
        bloqueado: parsed.data.bloqueado ?? false,
        descripcion: parsed.data.descripcion ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        opciones: (parsed.data.opciones ?? null) as any,
        orden: (last?.orden ?? -1) + 1,
        pipelineId,
        stageId,
      },
    });
    revalidatePath("/crm/pipeline");
    return { exito: true as const, id: campo.id };
  } catch {
    return { exito: false as const, error: "Error al crear el campo" };
  }
}

export async function actualizarCampoStage(id: string, datos: unknown) {
  const parsed = SchemaCampoPersonalizado.partial().safeParse(datos);
  if (!parsed.success) return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    await prisma.campoPersonalizado.update({
      where: { id },
      data: {
        ...(parsed.data.nombre && { nombre: parsed.data.nombre }),
        ...(parsed.data.clave && { clave: parsed.data.clave }),
        ...(parsed.data.tipo && { tipo: parsed.data.tipo as never }),
        ...(parsed.data.requerido !== undefined && { requerido: parsed.data.requerido }),
        ...(parsed.data.bloqueado !== undefined && { bloqueado: parsed.data.bloqueado }),
        ...(parsed.data.descripcion !== undefined && { descripcion: parsed.data.descripcion ?? null }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(parsed.data.opciones !== undefined && { opciones: (parsed.data.opciones ?? null) as any }),
      },
    });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al actualizar el campo" };
  }
}

export async function eliminarCampoStage(id: string) {
  try {
    await prisma.campoPersonalizado.update({ where: { id }, data: { activo: false } });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al eliminar el campo" };
  }
}

export async function duplicarCampoStage(campoId: string, targetStageId: string, targetPipelineId: string) {
  try {
    const campo = await prisma.campoPersonalizado.findUnique({ where: { id: campoId } });
    if (!campo) return { exito: false as const, error: "Campo no encontrado" };

    const existe = await prisma.campoPersonalizado.findFirst({
      where: { stageId: targetStageId, clave: campo.clave, activo: true },
    });
    if (existe) return { exito: false as const, error: `Ya existe un campo con la clave "${campo.clave}" en esa etapa` };

    const last = await prisma.campoPersonalizado.findFirst({
      where: { stageId: targetStageId, activo: true },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });

    const nuevo = await prisma.campoPersonalizado.create({
      data: {
        nombre: campo.nombre,
        clave: campo.clave,
        tipo: campo.tipo,
        entidad: campo.entidad,
        requerido: campo.requerido,
        bloqueado: campo.bloqueado,
        descripcion: campo.descripcion,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        opciones: campo.opciones as any,
        orden: (last?.orden ?? -1) + 1,
        pipelineId: targetPipelineId,
        stageId: targetStageId,
      },
    });

    revalidatePath("/crm/pipeline");
    return { exito: true as const, id: nuevo.id };
  } catch {
    return { exito: false as const, error: "Error al duplicar el campo" };
  }
}

export async function reordenarCamposStage(stageId: string, campoIds: string[]) {
  try {
    await prisma.$transaction(
      campoIds.map((id, index) =>
        prisma.campoPersonalizado.update({ where: { id }, data: { orden: index } })
      )
    );
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al reordenar los campos" };
  }
}
