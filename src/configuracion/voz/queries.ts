import { prisma } from "@/shared/db/prisma";
import { obtenerZonaNegocio } from "@/shared/fechas/negocio";
import { rangoHoy, rangoEsteMes, aFiltroPrisma } from "@/shared/fechas/rangos";

/**
 * 049 — Lecturas de la pestaña de Voz.
 *
 * Ninguna devuelve `apiKeyEncriptada`. El `select` es explícito justamente por
 * eso: con un `findMany` sin select, agregar un campo sensible al modelo lo
 * publicaría al cliente sin que nadie lo note (FR-002).
 */

export interface ProveedorVozListado {
  id: string;
  alias: string;
  proveedor: string;
  baseUrl: string | null;
  modelo: string;
  activo: boolean;
  prioridad: number;
  costoPorHora: string | null;
  limiteMinutosDia: number | null;
  timeoutMs: number;
  reintentosMax: number;
  tieneCredencial: boolean;
}

export async function obtenerProveedoresVoz(instanciaId: string): Promise<ProveedorVozListado[]> {
  const filas = await prisma.proveedorVoz.findMany({
    where: { instanciaId },
    orderBy: [{ activo: "desc" }, { prioridad: "desc" }, { alias: "asc" }],
    select: {
      id: true,
      alias: true,
      proveedor: true,
      baseUrl: true,
      modelo: true,
      activo: true,
      prioridad: true,
      costoPorHora: true,
      limiteMinutosDia: true,
      timeoutMs: true,
      reintentosMax: true,
      // Solo si HAY credencial, nunca cuál.
      apiKeyEncriptada: true,
    },
  });

  return filas.map(({ apiKeyEncriptada, costoPorHora, ...resto }) => ({
    ...resto,
    costoPorHora: costoPorHora ? costoPorHora.toString() : null,
    tieneCredencial: Boolean(apiKeyEncriptada),
  }));
}

export interface ResumenUsoVoz {
  hoy: { minutos: number; costo: number | null; transcripciones: number };
  mes: { minutos: number; costo: number | null; transcripciones: number };
}

/**
 * Minutos y costo consumidos.
 *
 * Los cortes de día y mes salen de `obtenerZonaNegocio`, NO de la zona del
 * navegador: "hoy" tiene que significar lo mismo para el comercio que para
 * cualquier otro total de Karia (regla 7 de CLAUDE.md).
 */
export async function obtenerResumenUsoVoz(instanciaId: string): Promise<ResumenUsoVoz> {
  const zona = await obtenerZonaNegocio(instanciaId);
  const ahora = new Date();

  const [hoy, mes] = await Promise.all([
    agregar(instanciaId, aFiltroPrisma(rangoHoy(zona, ahora))!),
    agregar(instanciaId, aFiltroPrisma(rangoEsteMes(zona, ahora))!),
  ]);

  return { hoy, mes };
}

async function agregar(instanciaId: string, rango: { gte: Date; lt: Date }) {
  const r = await prisma.usoVoz.aggregate({
    where: { instanciaId, exito: true, creadoEn: rango },
    _sum: { segundos: true, costoEstimado: true },
    _count: { _all: true },
  });

  return {
    minutos: Math.round(((r._sum.segundos ?? 0) / 60) * 10) / 10,
    costo: r._sum.costoEstimado ? Number(r._sum.costoEstimado) : null,
    transcripciones: r._count._all,
  };
}
