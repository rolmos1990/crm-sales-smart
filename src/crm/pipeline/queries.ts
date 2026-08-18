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

export async function obtenerOportunidadesPorPipeline(
  pipelineId: string,
  instanciaId: string,
  filtros?: FiltrosOportunidadParams,
) {
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
