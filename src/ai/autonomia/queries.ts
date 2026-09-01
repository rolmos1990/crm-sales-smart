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
