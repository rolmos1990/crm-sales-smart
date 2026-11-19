import { prisma } from "@/shared/db/prisma";

/**
 * 042 — Barrido de reconciliación (research D3). Los eventos de dominio se
 * publican con `void publicar(...)` después del commit, sin outbox: si uno se
 * pierde, el contacto nunca se marcaría. Este barrido lo detecta.
 *
 * Recorre cuenta por cuenta para que cada consulta use los índices que
 * empiezan por `instanciaId`, y mira solo una ventana reciente: nunca escanea
 * todos los contactos de todas las cuentas (FR-009).
 *
 * Las filas P2 de (a) y (c) se crean aunque el histórico esté pausado; no se
 * procesan mientras la pausa siga (la selección de turnos excluye P2).
 */

const VENTANA_HORAS = 24;
const LIMITE_POR_CUENTA = 1000;

export async function reconciliar(ahora: Date = new Date()): Promise<{ nuevos: number; conActividad: number; vencidos: number }> {
  const desde = new Date(ahora.getTime() - VENTANA_HORAS * 60 * 60_000);
  const cuentas = await prisma.instancia.findMany({ where: { estado: "ACTIVA" }, select: { id: true } });
  const totales = { nuevos: 0, conActividad: 0, vencidos: 0 };

  // El planificador recorre ConfiguracionAnalisisContactos: una cuenta sin fila
  // nunca recibiría turno. Las filas de cola que crea este barrido no pasan por
  // `marcarPendiente` (que la crea de forma perezosa), así que se asegura acá.
  if (cuentas.length > 0) {
    await prisma.configuracionAnalisisContactos.createMany({
      data: cuentas.map((c) => ({ instanciaId: c.id })),
      skipDuplicates: true,
    });
  }

  for (const { id: instanciaId } of cuentas) {
    try {
      // (a) Contactos recientes sin fila de cola (se perdió CONTACTO_CREADO).
      totales.nuevos += await prisma.$executeRaw`
        INSERT INTO "ContactoAnalisisCola" ("id", "contactoId", "instanciaId", "estado", "prioridad", "tipo", "motivo", "primerMarcadoEn", "elegibleDesde", "actualizadoEn")
        SELECT 'cq' || replace(gen_random_uuid()::text, '-', ''), c."id", c."instanciaId", 'PENDIENTE', 'P2', 'INICIAL', 'RECONCILIACION', now(), now(), now()
        FROM "Contacto" c
        WHERE c."instanciaId" = ${instanciaId} AND c."creadoEn" >= ${desde}
          AND NOT EXISTS (SELECT 1 FROM "ContactoAnalisisCola" q WHERE q."contactoId" = c."id")
        LIMIT ${LIMITE_POR_CUENTA}
        ON CONFLICT ("contactoId") DO NOTHING`;

      // (b) Actividad posterior a lo último evaluado y la cola AL_DIA (se perdió el marcado).
      totales.conActividad += await prisma.$executeRaw`
        UPDATE "ContactoAnalisisCola" q SET
          "estado" = 'PENDIENTE', "prioridad" = 'P1', "tipo" = 'INCREMENTAL', "motivo" = 'RECONCILIACION',
          "versionDatos" = q."versionDatos" + 1, "primerMarcadoEn" = now(), "elegibleDesde" = now(), "actualizadoEn" = now()
        FROM (
          SELECT c."id" FROM "Contacto" c
          JOIN "ContactoAnalisisCola" q2 ON q2."contactoId" = c."id"
          WHERE c."instanciaId" = ${instanciaId}
            AND c."ultimaInteraccionEn" >= ${desde}
            AND q2."estado" = 'AL_DIA'
            AND (q2."datosHasta" IS NULL OR c."ultimaInteraccionEn" > q2."datosHasta")
          LIMIT ${LIMITE_POR_CUENTA}
        ) pendientes
        WHERE q."contactoId" = pendientes."id"`;

      // (c) Evaluaciones vencidas: el estado cambia con el tiempo aunque no pase nada.
      totales.vencidos += await prisma.$executeRaw`
        UPDATE "ContactoAnalisisCola" q SET
          "estado" = 'PENDIENTE', "prioridad" = 'P2', "tipo" = 'REEVALUACION', "motivo" = 'VENCIMIENTO',
          "versionDatos" = q."versionDatos" + 1, "primerMarcadoEn" = now(), "elegibleDesde" = now(), "actualizadoEn" = now()
        FROM (
          SELECT e."contactoId" FROM "ContactoEvaluacion" e
          JOIN "ContactoAnalisisCola" q2 ON q2."contactoId" = e."contactoId"
          WHERE e."instanciaId" = ${instanciaId}
            AND e."proximaEvaluacionEn" <= ${ahora}
            AND q2."estado" = 'AL_DIA'
          LIMIT ${LIMITE_POR_CUENTA}
        ) vencidos
        WHERE q."contactoId" = vencidos."contactoId"`;
    } catch (err) {
      console.error("[worker:analisis] Error reconciliando la cuenta", { instanciaId, err });
    }
  }

  if (totales.nuevos + totales.conActividad + totales.vencidos > 0) {
    console.log(`[worker:analisis] reconciliación: ${JSON.stringify(totales)}`);
  }
  return totales;
}
