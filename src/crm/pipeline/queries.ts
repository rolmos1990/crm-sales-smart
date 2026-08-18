import { endOfDay } from "date-fns";
import { prisma } from "@/shared/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { CampoPersonalizadoModel as CampoPersonalizado } from "@/generated/prisma/models/CampoPersonalizado";
import type { CampoPersonalizadoPipeline, OportunidadEnStage } from "./types";
import type { FiltrosOportunidadParams } from "./schema";

/** Interpreta "yyyy-MM-dd" como fecha local (evita el corrimiento de UTC). */
function parsearFechaLocal(valor: string): Date | null {
  const fecha = new Date(`${valor}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

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

export async function obtenerPipelines(instanciaId: string) {
  const pipelines = await prisma.pipeline.findMany({
    where: { instanciaId, activo: true },
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

export async function obtenerCamposPorPipeline(pipelineId: string, instanciaId: string): Promise<CampoPersonalizadoPipeline[]> {
  const campos = await prisma.campoPersonalizado.findMany({
    where: { pipelineId, instanciaId, activo: true },
    orderBy: { orden: "asc" },
  });
  return campos.map(normalizarCampo);
}

/**
 * Arma el `where` compartido por las consultas del pipeline (lista de tarjetas
 * y totales agregados) a partir de los mismos filtros — evita que ambas
 * consultas puedan divergir en qué oportunidades cuentan.
 */
function construirWhereOportunidadesPipeline(
  pipelineId: string,
  instanciaId: string,
  filtros?: FiltrosOportunidadParams,
): Prisma.OportunidadWhereInput {
  // instanciaId siempre va en el where: es el límite multi-tenant y nunca
  // debe quedar a merced de los filtros que arma el usuario.
  const where: Prisma.OportunidadWhereInput = { pipelineId, instanciaId };

  const creadoDesde = filtros?.creadoDesde ? parsearFechaLocal(filtros.creadoDesde) : null;
  const creadoHasta = filtros?.creadoHasta ? parsearFechaLocal(filtros.creadoHasta) : null;
  if (creadoDesde || creadoHasta) {
    where.creadoEn = {
      ...(creadoDesde && { gte: creadoDesde }),
      ...(creadoHasta && { lte: endOfDay(creadoHasta) }),
    };
  }

  const cierreDesde = filtros?.cierreDesde ? parsearFechaLocal(filtros.cierreDesde) : null;
  const cierreHasta = filtros?.cierreHasta ? parsearFechaLocal(filtros.cierreHasta) : null;
  if (cierreDesde || cierreHasta) {
    where.fechaCierre = {
      ...(cierreDesde && { gte: cierreDesde }),
      ...(cierreHasta && { lte: endOfDay(cierreHasta) }),
    };
  }

  if (filtros?.contactoId) {
    where.contactos = { some: { contactoId: filtros.contactoId } };
  }

  if (filtros?.empresaId) {
    where.empresaId = filtros.empresaId;
  }

  if (filtros?.titulo) {
    where.titulo = { contains: filtros.titulo, mode: "insensitive" };
  }

  const tagIds = filtros?.tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];
  if (tagIds.length > 0) {
    where.tags = { some: { tagId: { in: tagIds } } };
  }

  return where;
}

export async function obtenerOportunidadesPorPipeline(
  pipelineId: string,
  instanciaId: string,
  filtros?: FiltrosOportunidadParams,
) {
  const where = construirWhereOportunidadesPipeline(pipelineId, instanciaId, filtros);

  const rows = await prisma.oportunidad.findMany({
    where,
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
      contactos: {
        orderBy: { principal: "desc" },
        take: 1,
        select: { contacto: { select: { id: true, nombre: true, apellido: true } } },
      },
      tags: { select: { tagId: true, tag: { select: { id: true, nombre: true, color: true } } } },
    },
    orderBy: { actualizadoEn: "desc" },
  });

  const porStage = new Map<string, OportunidadEnStage[]>();
  for (const op of rows) {
    const { contactos, ...resto } = op;
    const key = op.stageId ?? "__sin_stage__";
    const arr = porStage.get(key) ?? [];
    arr.push({ ...resto, valor: Number(op.valor), contacto: contactos[0]?.contacto ?? null });
    porStage.set(key, arr);
  }
  return porStage;
}

/**
 * Total de valor por etapa — un `GROUP BY stageId + SUM(valor)` resuelto en la
 * base de datos, sin traer las filas de oportunidad. A diferencia de sumar
 * `valor` sobre la lista completa ya cargada para las tarjetas, esta consulta
 * no depende de tener todas las filas en memoria — se mantiene liviana aunque
 * el volumen de oportunidades crezca mucho a futuro (ej. si las columnas del
 * Kanban se paginan o virtualizan más adelante).
 */
export async function obtenerTotalesPorStage(
  pipelineId: string,
  instanciaId: string,
  filtros?: FiltrosOportunidadParams,
): Promise<Map<string, number>> {
  const where = construirWhereOportunidadesPipeline(pipelineId, instanciaId, filtros);

  const totales = await prisma.oportunidad.groupBy({
    by: ["stageId"],
    where,
    _sum: { valor: true },
  });

  const porStage = new Map<string, number>();
  for (const t of totales) {
    const key = t.stageId ?? "__sin_stage__";
    porStage.set(key, Number(t._sum.valor ?? 0));
  }
  return porStage;
}
