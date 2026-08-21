import { prisma } from "@/shared/db/prisma";
import type { Etapa } from "@/generated/prisma/enums";
import { rangoDiaEnZona } from "@/sales/pedidos/utils/fechas-zona";
import {
  construirWhere, construirWhereBase, condicionActiva,
  type OportunidadesFiltros,
} from "./filtros-oportunidades";

export type { OportunidadesFiltros } from "./filtros-oportunidades";

export async function obtenerOportunidades(instanciaId: string, filtros?: OportunidadesFiltros, zonaHoraria = "America/Lima") {
  const where = construirWhere(instanciaId, zonaHoraria, filtros);
  return prisma.oportunidad.findMany({
    where,
    include: {
      empresa: { select: { id: true, nombre: true } },
      contactos: { include: { contacto: { select: { id: true, nombre: true, apellido: true } } } },
      stage: { select: { id: true, nombre: true, color: true } },
    },
    orderBy: { creadoEn: "desc" },
  });
}

export interface OportunidadesKpis {
  activas: number;
  valorPipeline: number;
  porVencer: number;
  vencidas: number;
}

/**
 * KPIs de la cabecera — resueltos 100% en BD (aggregate/count), nunca
 * sumando en el cliente. Los 3 primeros ("activas", "valorPipeline",
 * "porVencer") y "vencidas" comparten `whereBase` (todos los filtros salvo
 * vencimiento — ver construirWhereBase) y cada uno agrega su propia
 * condición de fecha, para que "por vencer"/"vencidas" no dependan de qué
 * filtro rápido de vencimiento esté aplicado en la tabla (mismo criterio que
 * "Total ventas · mes actual" en obtenerPedidosKpis).
 */
export async function obtenerOportunidadesKpis(
  instanciaId: string,
  filtros: OportunidadesFiltros | undefined,
  zonaHoraria: string
): Promise<OportunidadesKpis> {
  const whereBase = construirWhereBase(instanciaId, zonaHoraria, filtros);
  const activa = condicionActiva();
  const hoy = rangoDiaEnZona(zonaHoraria, 0);
  const en7dias = rangoDiaEnZona(zonaHoraria, 7);

  const [totalesActivas, porVencer, vencidas] = await Promise.all([
    prisma.oportunidad.aggregate({
      where: { ...whereBase, ...activa },
      _count: true,
      _sum: { valor: true },
    }),
    prisma.oportunidad.count({
      where: { ...whereBase, ...activa, fechaCierre: { gte: hoy.desde, lt: en7dias.desde } },
    }),
    prisma.oportunidad.count({
      where: { ...whereBase, ...activa, fechaCierre: { lt: hoy.desde } },
    }),
  ]);

  return {
    activas: totalesActivas._count,
    valorPipeline: Number(totalesActivas._sum.valor ?? 0),
    porVencer,
    vencidas,
  };
}

// Últimas oportunidades del contacto distintas de la actual — para el
// historial "Oportunidades anteriores" del panel de contacto en el Inbox.
export async function obtenerOportunidadesAnterioresContacto(
  contactoId: string,
  instanciaId: string,
  excluirId?: string | null,
  limite = 5
) {
  return prisma.oportunidad.findMany({
    where: {
      instanciaId,
      contactos: { some: { contactoId, principal: true } },
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    select: {
      id: true,
      titulo: true,
      etapa: true,
      fechaGanada: true,
      fechaPerdida: true,
      actualizadoEn: true,
      stage: { select: { nombre: true, esGanado: true, esPerdido: true, color: true } },
    },
    orderBy: { actualizadoEn: "desc" },
    take: limite,
  });
}

export async function obtenerOportunidadesPorEtapa(instanciaId: string) {
  const oportunidades = await prisma.oportunidad.findMany({
    where: { instanciaId, etapa: { notIn: ["GANADO", "PERDIDO"] }, pipelineId: null },
    include: {
      empresa: { select: { id: true, nombre: true } },
      contactos: { include: { contacto: { select: { id: true, nombre: true, apellido: true } } } },
      tags: { select: { tagId: true, tag: { select: { id: true, nombre: true, color: true } } } },
    },
    orderBy: { actualizadoEn: "desc" },
  });

  const agrupadas = new Map<Etapa, typeof oportunidades>();
  for (const o of oportunidades) {
    if (!agrupadas.has(o.etapa)) agrupadas.set(o.etapa, []);
    agrupadas.get(o.etapa)!.push(o);
  }
  return agrupadas;
}

export async function obtenerOportunidadPorId(id: string, instanciaId: string) {
  return prisma.oportunidad.findFirst({
    where: { id, instanciaId },
    include: {
      empresa: {
        select: {
          id: true, nombre: true, ruc: true, industria: true,
          sitioWeb: true, telefono: true, email: true, notas: true,
        },
      },
      contactos: {
        include: {
          contacto: {
            select: {
              id: true, nombre: true, apellido: true, email: true,
              telefonoPrincipal: true, telefonoSecundario: true,
              cargo: true, notas: true, estado: true,
              empresa: { select: { id: true, nombre: true } },
            },
          },
        },
      },
      productos: { include: { producto: true } },
      actividades: { orderBy: { fecha: "desc" }, take: 10 },
      tags: { include: { tag: true } },
      campos: { include: { campo: true }, orderBy: { campo: { orden: "asc" } } },
      stage: { select: { id: true, nombre: true, color: true } },
    },
  });
}
