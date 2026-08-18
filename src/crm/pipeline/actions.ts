"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { SchemaPipeline, SchemaStage, SchemaCampoPersonalizado } from "./schema";
import { obtenerPipelines } from "./queries";
import { procesarCambioStage } from "./disparadores/motor";

async function requireAdminPipeline() {
  const sesion = await requireSesion();
  const acceso = verificarAcceso(sesion, "pipeline", "modificar");
  return { sesion, acceso };
}

export async function obtenerPipelinesAction() {
  const sesion = await requireSesion();
  return obtenerPipelines(sesion.instanciaId);
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

  const { sesion, acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

  try {
    const pipeline = await prisma.pipeline.create({
      data: {
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion ?? null,
        instanciaId: sesion.instanciaId,
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

  const { acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

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
  const { acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

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

  const { acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

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

  const { acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

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
  const { acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

  try {
    await prisma.pipelineStage.update({ where: { id }, data: { activo: false } });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al eliminar la etapa" };
  }
}

export async function reordenarStages(pipelineId: string, stageIds: string[]) {
  const { acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

  try {
    // PipelineStage tiene un unique constraint en (pipelineId, orden). Asignar
    // el orden final directamente, una etapa a la vez, puede chocar contra el
    // valor que OTRA etapa todavía tiene en ese instante (ej. un swap simple
    // A↔B) y Postgres rechaza el UPDATE a mitad de camino. Se resuelve en dos
    // fases: primero se mueven todas a valores negativos temporales —
    // garantizado que no chocan entre sí ni con ningún orden real— y luego se
    // asigna el orden definitivo.
    await prisma.$transaction([
      ...stageIds.map((id, index) =>
        prisma.pipelineStage.update({ where: { id }, data: { orden: -(index + 1) } })
      ),
      ...stageIds.map((id, index) =>
        prisma.pipelineStage.update({ where: { id }, data: { orden: index } })
      ),
    ]);
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al reordenar" };
  }
}

export async function moverAStage(oportunidadId: string, stageId: string, pipelineId: string) {
  const auth = await requirePermisoAction("oportunidades", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const [stage, todosCampos, oportunidad] = await Promise.all([
      prisma.pipelineStage.findUnique({
        where: { id: stageId },
        select: { nombre: true, probabilidad: true, esGanado: true, esPerdido: true },
      }),
      prisma.campoPersonalizado.findMany({
        where: { pipelineId, activo: true },
        select: { nombre: true, clave: true, requeridoEn: true },
      }),
      prisma.oportunidad.findUnique({
        where: { id: oportunidadId },
        select: { metadata: true },
      }),
    ]);

    // Validar campos requeridos para el stage destino
    const camposRequeridos = todosCampos.filter(
      (c) => Array.isArray(c.requeridoEn) && (c.requeridoEn as string[]).includes(stageId)
    );
    if (camposRequeridos.length > 0) {
      const metadata = (oportunidad?.metadata as Record<string, unknown>) ?? {};
      const faltantes = camposRequeridos
        .filter((c) => {
          const v = metadata[c.clave];
          return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
        })
        .map((c) => c.nombre);
      if (faltantes.length > 0) {
        return {
          exito: false as const,
          error: `Para avanzar a "${stage?.nombre ?? stageId}" debes completar: ${faltantes.join(", ")}`,
        };
      }
    }

    const ahora = new Date();
    await prisma.oportunidad.update({
      where: { id: oportunidadId },
      data: {
        stageId,
        pipelineId,
        ...(stage != null && { probabilidad: stage.probabilidad }),
        ...(stage?.esGanado && { etapa: "GANADO", fechaGanada: ahora }),
        ...(stage?.esPerdido && { etapa: "PERDIDO", fechaPerdida: ahora }),
      },
    });

    // Cerrar conversaciones asociadas si la etapa es terminal
    if (stage?.esGanado || stage?.esPerdido) {
      await cerrarConversacionesDeOportunidad(oportunidadId);
    }

    await procesarCambioStage(oportunidadId, stageId, pipelineId);
    revalidatePath("/crm/pipeline");
    revalidatePath("/crm/oportunidades");
    revalidatePath("/crm/inbox");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al mover la oportunidad" };
  }
}

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

// ── Campos personalizados del Pipeline ──────────────────────────────

export async function crearCampoPipeline(pipelineId: string, datos: unknown) {
  const parsed = SchemaCampoPersonalizado.safeParse(datos);
  if (!parsed.success) return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

  try {
    const existe = await prisma.campoPersonalizado.findFirst({
      where: { pipelineId, clave: parsed.data.clave, activo: true },
    });
    if (existe) return { exito: false as const, error: `Ya existe un campo con la clave "${parsed.data.clave}"` };

    const last = await prisma.campoPersonalizado.findFirst({
      where: { pipelineId, activo: true },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });
    const campo = await prisma.campoPersonalizado.create({
      data: {
        nombre: parsed.data.nombre,
        clave: parsed.data.clave,
        tipo: parsed.data.tipo as never,
        entidad: "OPORTUNIDAD",
        descripcion: parsed.data.descripcion ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        opciones: (parsed.data.opciones ?? null) as any,
        orden: (last?.orden ?? -1) + 1,
        pipelineId,
        stageId: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        visibleEn: parsed.data.visibleEn as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        requeridoEn: parsed.data.requeridoEn as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bloqueadoEn: parsed.data.bloqueadoEn as any,
      },
    });
    revalidatePath("/crm/pipeline");
    return { exito: true as const, id: campo.id };
  } catch {
    return { exito: false as const, error: "Error al crear el campo" };
  }
}

export async function actualizarCampoPipeline(id: string, datos: unknown) {
  const parsed = SchemaCampoPersonalizado.partial().safeParse(datos);
  if (!parsed.success) return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

  try {
    await prisma.campoPersonalizado.update({
      where: { id },
      data: {
        ...(parsed.data.nombre && { nombre: parsed.data.nombre }),
        ...(parsed.data.clave && { clave: parsed.data.clave }),
        ...(parsed.data.tipo && { tipo: parsed.data.tipo as never }),
        ...(parsed.data.descripcion !== undefined && { descripcion: parsed.data.descripcion ?? null }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(parsed.data.opciones !== undefined && { opciones: (parsed.data.opciones ?? null) as any }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(parsed.data.visibleEn !== undefined && { visibleEn: parsed.data.visibleEn as any }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(parsed.data.requeridoEn !== undefined && { requeridoEn: parsed.data.requeridoEn as any }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(parsed.data.bloqueadoEn !== undefined && { bloqueadoEn: parsed.data.bloqueadoEn as any }),
      },
    });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al actualizar el campo" };
  }
}

export async function eliminarCampo(id: string) {
  const { acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

  try {
    await prisma.campoPersonalizado.update({ where: { id }, data: { activo: false } });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al eliminar el campo" };
  }
}

export async function toggleEstadoCampo(id: string, activo: boolean) {
  const { acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

  try {
    await prisma.campoPersonalizado.update({ where: { id }, data: { activo } });
    revalidatePath("/crm/pipeline");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al cambiar el estado del campo" };
  }
}

export async function reordenarCamposPipeline(pipelineId: string, campoIds: string[]) {
  const { acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

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

/** @deprecated Usar crearCampoPipeline */
export async function crearCampoStage(pipelineId: string, _stageId: string, datos: unknown) {
  return crearCampoPipeline(pipelineId, datos);
}

/** @deprecated Usar actualizarCampoPipeline */
export async function actualizarCampoStage(id: string, datos: unknown) {
  return actualizarCampoPipeline(id, datos);
}

/** @deprecated Usar eliminarCampo */
export async function eliminarCampoStage(id: string) {
  return eliminarCampo(id);
}

// ── Auto-respuesta IA por etapa ──────────────────────────────────────────────

export async function toggleAutoRespuestaIAStage(
  stageId: string,
  habilitada: boolean,
  agenteIAConfigId?: string | null,
) {
  const { sesion, acceso } = await requireAdminPipeline();
  if (!acceso.permitido) return { exito: false as const, error: acceso.error! };

  // Verificar que el stage pertenece a la instancia
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipeline: { instanciaId: sesion.instanciaId } },
    select: { id: true },
  });
  if (!stage) return { exito: false as const, error: "Etapa no encontrada" };

  await prisma.pipelineStage.update({
    where: { id: stageId },
    data: {
      respuestaIAHabilitada: habilitada,
      agenteIAConfigId: habilitada ? (agenteIAConfigId ?? null) : null,
    },
  });

  revalidatePath("/crm/pipeline");
  return { exito: true as const };
}
