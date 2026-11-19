import { prisma } from "@/shared/db/prisma";
import { MAX_INTENTOS } from "../cola";

/**
 * 042 — Recupera el trabajo de un worker que se cayó o se colgó (FR-034,
 * FR-042). Mismo criterio que `recuperarJobsInterrumpidos` de los disparadores:
 * todo lo tomado tiene un lease; vencido el lease, vuelve a estar disponible.
 *
 * Idempotente: correrlo en cada ciclo, en cualquier réplica, no hace daño.
 */
export async function recuperarTrabajoAbandonado(ahora: Date = new Date()): Promise<{
  reencolados: number;
  fallidos: number;
  abandonadas: number;
}> {
  const [reencolados, fallidos, abandonadas] = await Promise.all([
    prisma.contactoAnalisisCola.updateMany({
      where: { estado: "EN_PROCESO", bloqueadoHasta: { lt: ahora }, intentos: { lt: MAX_INTENTOS - 1 } },
      data: { estado: "PENDIENTE", intentos: { increment: 1 }, elegibleDesde: ahora, bloqueadoHasta: null, versionReclamada: null },
    }),
    prisma.contactoAnalisisCola.updateMany({
      where: { estado: "EN_PROCESO", bloqueadoHasta: { lt: ahora }, intentos: { gte: MAX_INTENTOS - 1 } },
      data: { estado: "FALLIDO", intentos: { increment: 1 }, bloqueadoHasta: null, versionReclamada: null },
    }),
    prisma.ejecucionAnalisisContactos.updateMany({
      where: { estado: "EN_CURSO", leaseHasta: { lt: ahora } },
      data: {
        estado: "ABANDONADA",
        finalizadoEn: ahora,
        errorCodigo: "INTERRUMPIDA",
        errorMensaje: "El worker se detuvo mientras procesaba el lote",
      },
    }),
  ]);

  if (abandonadas.count > 0 || reencolados.count > 0 || fallidos.count > 0) {
    await recalcularLotesEnCurso();
  }
  return { reencolados: reencolados.count, fallidos: fallidos.count, abandonadas: abandonadas.count };
}

/**
 * `lotesEnCurso` es un contador para el planificador; si un worker muere sin
 * decrementarlo, se corrige contando las atenciones que siguen EN_CURSO.
 */
export async function recalcularLotesEnCurso(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "ConfiguracionAnalisisContactos" c
    SET "lotesEnCurso" = COALESCE(e.n, 0)
    FROM (
      -- Un turno abre varias atenciones (reglas, IA, divisiones) con el mismo loteId.
      SELECT ci."instanciaId", COUNT(DISTINCT ej."loteId")::int AS n
      FROM "ConfiguracionAnalisisContactos" ci
      LEFT JOIN "EjecucionAnalisisContactos" ej
        ON ej."instanciaId" = ci."instanciaId" AND ej."estado" = 'EN_CURSO'
      GROUP BY ci."instanciaId"
    ) e
    WHERE c."instanciaId" = e."instanciaId" AND c."lotesEnCurso" <> COALESCE(e.n, 0)`;
}
