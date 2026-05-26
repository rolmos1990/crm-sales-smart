import { prisma } from "@/shared/db/prisma";

/**
 * Cancela jobs PENDIENTE del oportunidad para stages distintos al actual,
 * y encola nuevos jobs para todos los disparadores activos del nuevo stage.
 */
export async function procesarCambioStage(
  oportunidadId: string,
  stageId: string,
  pipelineId: string
) {
  // Cancelar pendientes de stages anteriores en este pipeline
  await prisma.disparadorJob.updateMany({
    where: {
      oportunidadId,
      pipelineId,
      stageId: { not: stageId },
      estado: "PENDIENTE",
    },
    data: { estado: "CANCELADO" },
  });

  const disparadores = await prisma.disparador.findMany({
    where: { stageId, pipelineId, activo: true },
    orderBy: { orden: "asc" },
  });

  if (disparadores.length === 0) return;

  const oportunidad = await prisma.oportunidad.findUnique({
    where: { id: oportunidadId },
    select: { titulo: true, valor: true, moneda: true },
  });

  const ahora = new Date();
  await prisma.disparadorJob.createMany({
    data: disparadores.map((d) => ({
      disparadorId: d.id,
      oportunidadId,
      stageId,
      pipelineId,
      estado: "PENDIENTE" as const,
      ejecutarEn: d.delayMinutos
        ? new Date(ahora.getTime() + d.delayMinutos * 60 * 1000)
        : ahora,
      payload: {
        disparadorNombre: d.nombre,
        tipo: d.tipo,
        config: d.config,
        oportunidad: oportunidad ?? { titulo: "—", valor: 0, moneda: "PEN" },
      },
    })),
  });
}
