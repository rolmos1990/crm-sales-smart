import { prisma } from "@/shared/db/prisma";
import type { CampoPersonalizadoModel as CampoPersonalizado } from "@/generated/prisma/models/CampoPersonalizado";
import type { CampoPersonalizadoPipeline, OportunidadEnStage } from "./types";

function normalizarCampo(raw: CampoPersonalizado): CampoPersonalizadoPipeline {
  return {
    id: raw.id,
    nombre: raw.nombre,
    clave: raw.clave,
    tipo: raw.tipo as CampoPersonalizadoPipeline["tipo"],
    descripcion: raw.descripcion,
    opciones: Array.isArray(raw.opciones) ? (raw.opciones as string[]) : null,
    orden: raw.orden,
    activo: raw.activo,
    pipelineId: raw.pipelineId,
    visibleEn: Array.isArray(raw.visibleEn) ? (raw.visibleEn as string[]) : [],
    requeridoEn: Array.isArray(raw.requeridoEn) ? (raw.requeridoEn as string[]) : [],
    bloqueadoEn: Array.isArray(raw.bloqueadoEn) ? (raw.bloqueadoEn as string[]) : [],
  };
}

export async function obtenerPipelines() {
  const pipelines = await prisma.pipeline.findMany({
    where: { activo: true },
    include: {
      stages: {
        where: { activo: true },
        orderBy: { orden: "asc" },
      },
      campos: {
        where: { activo: true },
        orderBy: { orden: "asc" },
      },
    },
    orderBy: [{ esDefault: "desc" }, { creadoEn: "asc" }],
  });

  return pipelines.map((p) => ({
    ...p,
    campos: p.campos.map(normalizarCampo),
  }));
}

export async function obtenerCamposPorPipeline(pipelineId: string): Promise<CampoPersonalizadoPipeline[]> {
  const campos = await prisma.campoPersonalizado.findMany({
    where: { pipelineId, activo: true },
    orderBy: { orden: "asc" },
  });
  return campos.map(normalizarCampo);
}

export async function obtenerOportunidadesPorPipeline(pipelineId: string) {
  const rows = await prisma.oportunidad.findMany({
    where: { pipelineId },
    select: {
      id: true,
      titulo: true,
      valor: true,
      moneda: true,
      probabilidad: true,
      fechaCierre: true,
      stageId: true,
      pipelineId: true,
      nuevoMensaje: true,
      empresa: { select: { id: true, nombre: true } },
      tags: { select: { tagId: true, tag: { select: { id: true, nombre: true, color: true } } } },
    },
    orderBy: { actualizadoEn: "desc" },
  });

  const porStage = new Map<string, OportunidadEnStage[]>();
  for (const op of rows) {
    const key = op.stageId ?? "__sin_stage__";
    const arr = porStage.get(key) ?? [];
    arr.push({ ...op, valor: Number(op.valor) });
    porStage.set(key, arr);
  }
  return porStage;
}
