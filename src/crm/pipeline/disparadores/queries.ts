import { prisma } from "@/shared/db/prisma";
import type { Disparador, DisparadorJob } from "./types";

export async function obtenerDisparadores(stageId: string, instanciaId: string): Promise<Disparador[]> {
  const rows = await prisma.disparador.findMany({
    where: { stageId, pipeline: { instanciaId }, activo: true },
    orderBy: { orden: "asc" },
  });
  return rows.map((r) => ({
    ...r,
    config: r.config as unknown as Disparador["config"],
  }));
}

export async function obtenerDisparadoresPorPipeline(pipelineId: string, instanciaId: string): Promise<
  (Disparador & { jobs: Pick<DisparadorJob, "id" | "estado" | "ejecutarEn" | "creadoEn">[] })[]
> {
  const rows = await prisma.disparador.findMany({
    where: { pipelineId, pipeline: { instanciaId }, activo: true },
    orderBy: [{ stageId: "asc" }, { orden: "asc" }],
    include: {
      jobs: {
        select: { id: true, estado: true, ejecutarEn: true, creadoEn: true },
        orderBy: { creadoEn: "desc" },
        take: 5,
      },
    },
  });
  return rows.map((r) => ({
    ...r,
    config: r.config as unknown as Disparador["config"],
    jobs: r.jobs.map((j) => ({
      ...j,
      estado: j.estado as DisparadorJob["estado"],
    })),
  }));
}

// Usado por el worker interno — NO filtrar por instanciaId (procesa todas las instancias)
export async function obtenerJobsPendientes(): Promise<DisparadorJob[]> {
  const rows = await prisma.disparadorJob.findMany({
    where: { estado: "PENDIENTE", ejecutarEn: { lte: new Date() } },
    orderBy: { ejecutarEn: "asc" },
    take: 50,
  });
  return rows.map((r) => ({
    ...r,
    estado: r.estado as DisparadorJob["estado"],
    payload: r.payload as DisparadorJob["payload"],
    resultado: r.resultado as DisparadorJob["resultado"],
  }));
}
