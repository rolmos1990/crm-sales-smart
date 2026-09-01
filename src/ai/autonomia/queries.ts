import { prisma } from "@/shared/db/prisma";
import type { CategoriaIntencionAutonomia } from "@/generated/prisma/enums";
import type { AutonomiaIntencionConfigItem, CondicionesConfianza } from "./tipos";

/**
 * `null` significa que el agente no tiene ninguna fila configurada — el
 * llamador (el suscriptor) MUST tratar esto como "comportamiento por
 * defecto, sin clasificar" (FR-004, research.md Decisión 3).
 */
export async function obtenerAutonomiaPorAgente(
  agenteIAConfigId: string,
): Promise<Map<CategoriaIntencionAutonomia, AutonomiaIntencionConfigItem> | null> {
  const filas = await prisma.autonomiaIntencionConfig.findMany({
    where: { agenteIAConfigId },
    select: { categoria: true, nivel: true, condicionesConfianza: true },
  });

  if (filas.length === 0) return null;

  const mapa = new Map<CategoriaIntencionAutonomia, AutonomiaIntencionConfigItem>();
  for (const fila of filas) {
    mapa.set(fila.categoria, {
      categoria: fila.categoria,
      nivel: fila.nivel,
      condicionesConfianza: (fila.condicionesConfianza as CondicionesConfianza | null) ?? null,
    });
  }
  return mapa;
}

export async function listarAutonomiaPorAgente(agenteIAConfigId: string) {
  return prisma.autonomiaIntencionConfig.findMany({
    where: { agenteIAConfigId },
    orderBy: { categoria: "asc" },
  });
}

export async function listarRespuestasPendientes(instanciaId: string, conversacionId?: string) {
  return prisma.respuestaPendienteRevision.findMany({
    where: {
      instanciaId,
      estado: "PENDIENTE",
      ...(conversacionId ? { conversacionId } : {}),
    },
    orderBy: { creadoEn: "desc" },
    include: {
      conversacion: { select: { id: true, contacto: { select: { id: true, nombre: true, apellido: true } } } },
    },
  });
}

// 017-aprendizaje-supervisado-auditoria (Historia 3) — insumo de
// ejecutarAnalisisPiloto (014) cuando opciones.incluirCorreccionesRecientes
// es true (research.md Decisión 5).
export async function listarCorreccionesRecientes(instanciaId: string, agenteIAConfigId?: string, limite = 10) {
  return prisma.respuestaPendienteRevision.findMany({
    where: {
      instanciaId,
      estado: "EDITADA_Y_ENVIADA",
      ...(agenteIAConfigId ? { agenteIAConfigId } : {}),
    },
    orderBy: { creadoEn: "desc" },
    take: limite,
    select: { mensajeCliente: true, respuestaPropuesta: true, respuestaEditada: true },
  });
}

// 017-aprendizaje-supervisado-auditoria — consulta consolidada (SC-002):
// un único objeto por respuesta, con UsoIA (versión/modelo/tiempo/consumo)
// y sus EvaluacionRespuestaIA ya resueltos por join, sin que el llamador
// deba cruzar tablas manualmente.
export async function listarRegistrosRespuesta(
  instanciaId: string,
  filtros?: { agenteIAConfigId?: string; conversacionId?: string; desde?: Date; hasta?: Date },
) {
  return prisma.respuestaPendienteRevision.findMany({
    where: {
      instanciaId,
      ...(filtros?.agenteIAConfigId ? { agenteIAConfigId: filtros.agenteIAConfigId } : {}),
      ...(filtros?.conversacionId ? { conversacionId: filtros.conversacionId } : {}),
      ...(filtros?.desde || filtros?.hasta
        ? { creadoEn: { ...(filtros.desde ? { gte: filtros.desde } : {}), ...(filtros.hasta ? { lte: filtros.hasta } : {}) } }
        : {}),
    },
    orderBy: { creadoEn: "desc" },
    include: {
      usoIA: {
        select: {
          modelo: true,
          proveedorIA: { select: { proveedor: true } },
          tiempoMs: true,
          tokensInput: true,
          tokensOutput: true,
          costoEstimado: true,
          agenteIAConfigVersionId: true,
        },
      },
      evaluaciones: { orderBy: { evaluadoEn: "desc" } },
      productoIdentificado: { select: { id: true, nombre: true } },
      conversacion: { select: { id: true, contacto: { select: { id: true, nombre: true, apellido: true } } } },
    },
  });
}
