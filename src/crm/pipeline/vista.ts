import "server-only";

import { obtenerConteoPorStage, obtenerOportunidadesPorPipeline, obtenerTotalesPorStage } from "./queries";
import { SchemaFiltrosOportunidad } from "./schema";
import { LIMITE_POR_STAGE } from "./constantes";
import type { OportunidadEnStage } from "./types";

export interface VistaPipeline {
  oportunidadesPorStage: Map<string, OportunidadEnStage[]>;
  totalesPorStage: Map<string, number>;
  /** Conteo real por etapa (no el cargado) — ver pipeline-kanban-dinamico.tsx. */
  conteoPorStage: Map<string, number>;
  hayFiltrosAplicados: boolean;
}

/**
 * Datos del Kanban dinámico para un pipeline y una combinación de filtros
 * (mismo formato clave → string que tenían en la URL: los del drawer más
 * `limites=stageId:40,…` para la paginación por etapa). Lo usan la página
 * (sin filtros, primer render) y la Server Action que consulta el tablero.
 */
export async function cargarVistaPipeline(
  pipelineId: string,
  instanciaId: string,
  zonaHoraria: string,
  sp: Record<string, string>,
): Promise<VistaPipeline> {
  // Se validan antes de llegar al `where` de Prisma (ver crm/pipeline/queries.ts).
  const filtrosParsed = SchemaFiltrosOportunidad.safeParse(sp);
  const filtros = filtrosParsed.success ? filtrosParsed.data : undefined;

  // Overrides puntuales por etapa: cada columna del Kanban pagina de forma
  // independiente, así que una etapa que el usuario ya scrolleó más allá del
  // default necesita su propio número.
  const limitesPorStage = new Map<string, number>();
  for (const par of (sp.limites ?? "").split(",")) {
    const [stageId, valorRaw] = par.split(":");
    const valor = Number(valorRaw);
    if (stageId && Number.isFinite(valor) && valor > 0) limitesPorStage.set(stageId, Math.floor(valor));
  }

  const [oportunidadesPorStage, totalesPorStage, conteoPorStage] = await Promise.all([
    obtenerOportunidadesPorPipeline(pipelineId, instanciaId, zonaHoraria, filtros, LIMITE_POR_STAGE, limitesPorStage),
    obtenerTotalesPorStage(pipelineId, instanciaId, zonaHoraria, filtros),
    obtenerConteoPorStage(pipelineId, instanciaId, zonaHoraria, filtros),
  ]);

  return {
    oportunidadesPorStage,
    totalesPorStage,
    conteoPorStage,
    hayFiltrosAplicados: !!filtros && Object.keys(filtros).length > 0,
  };
}
