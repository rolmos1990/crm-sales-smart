import { prisma } from "@/shared/db/prisma";
import { DefinicionWorkflowSchema } from "./schema";
import type { ConsultasReferencias } from "./validador";

// Implementación con Prisma de las consultas que usa validarReferencias.
// Todas filtran por instancia: una referencia a otra empresa cuenta como
// inexistente.
export function crearConsultasReferencias(instanciaId: string): ConsultasReferencias {
  return {
    async agentesIA(ids) {
      const filas = await prisma.agenteIAConfig.findMany({
        where: { id: { in: ids }, instanciaId },
        select: { id: true },
      });
      return new Set(filas.map((f) => f.id));
    },

    async etapas(ids) {
      const filas = await prisma.pipelineStage.findMany({
        where: { id: { in: ids }, activo: true, pipeline: { instanciaId } },
        select: {
          id: true,
          pipelineId: true,
          workflowAsignaciones: {
            where: { activo: true, disparador: "ENTRADA_ETAPA" },
            select: { id: true },
            take: 1,
          },
        },
      });
      return new Map(
        filas.map((f) => [f.id, { pipelineId: f.pipelineId, tieneWorkflow: f.workflowAsignaciones.length > 0 }]),
      );
    },

    async usuarios(ids) {
      const filas = await prisma.usuarioInstancia.findMany({
        where: { id: { in: ids }, instanciaId, activo: true },
        select: { id: true },
      });
      return new Set(filas.map((f) => f.id));
    },

    async etiquetas(ids) {
      const filas = await prisma.tag.findMany({
        where: { id: { in: ids }, instanciaId, activo: true },
        select: { id: true },
      });
      return new Set(filas.map((f) => f.id));
    },

    async workflowsPublicados(ids) {
      if (ids.length === 0) return new Map();
      const filas = await prisma.workflow.findMany({
        where: { id: { in: ids }, instanciaId, estado: "PUBLICADO", versionPublicadaId: { not: null } },
        select: { id: true, versionPublicada: { select: { definicion: true } } },
      });
      return new Map(
        filas.map((f) => {
          const def = DefinicionWorkflowSchema.safeParse(f.versionPublicada?.definicion);
          const refs = def.success
            ? def.data.nodos
                .filter((n) => n.tipo === "EJECUTAR_WORKFLOW" && typeof n.config.workflowId === "string")
                .map((n) => n.config.workflowId as string)
            : [];
          return [f.id, refs];
        }),
      );
    },
  };
}
