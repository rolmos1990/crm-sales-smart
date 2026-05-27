import { prisma } from "@/shared/db/prisma";
import type { OportunidadEnStage } from "./types";

export async function obtenerPipelines() {
  return prisma.pipeline.findMany({
    where: { activo: true },
    include: {
      stages: {
        where: { activo: true },
        orderBy: { orden: "asc" },
        include: {
          campos: {
            where: { activo: true },
            orderBy: { orden: "asc" },
          },
        },
      },
    },
    orderBy: [{ esDefault: "desc" }, { creadoEn: "asc" }],
  });
}

export async function obtenerCamposPorStage(stageId: string) {
  return prisma.campoPersonalizado.findMany({
    where: { stageId, activo: true },
    orderBy: { orden: "asc" },
  });
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
