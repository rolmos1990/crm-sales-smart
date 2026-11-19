import { Prisma } from "@/generated/prisma/client";
import type { PrioridadAnalisis, TipoEjecucionAnalisis } from "@/generated/prisma/enums";
import { prisma } from "@/shared/db/prisma";
import type { ContactoReclamado, MotivoMarcado } from "./types";

/**
 * 042 — Cola durable del análisis de contactos (research D1, D3, D4, D11).
 *
 * Una fila PERMANENTE por contacto en `ContactoAnalisisCola`. Marcar es un
 * único `INSERT ... ON CONFLICT DO UPDATE`: diez eventos sobre el mismo
 * contacto dejan una sola fila con la versión subida diez veces (FR-007).
 * Reclamar usa `FOR UPDATE SKIP LOCKED` con un lease, el mismo patrón que
 * `reclamarJobs` de los disparadores de pipeline: dos workers nunca toman el
 * mismo contacto y un worker caído suelta su trabajo al vencer el lease.
 */

export const MAX_INTENTOS = 5;
const BACKOFF_BASE_SEG = 30;
const BACKOFF_TOPE_SEG = 30 * 60;

// Pedidos explícitos de una persona: reabren un contacto FALLIDO. Un evento
// automático no lo reabre, para no reintentar sin fin algo que ya falló 5 veces.
const MOTIVOS_QUE_REABREN: MotivoMarcado[] = ["MANUAL", "MANUAL_REINTENTO", "SELECCION", "SEGMENTO"];

// ── Parámetros de la cuenta (caché de 60 s, sin upsert por mensaje) ─────────

interface ParametrosCola {
  ventanaAgrupacionSeg: number;
  esperaMaximaSeg: number;
}

const TTL_PARAMETROS_MS = 60_000;
const cacheParametros = new Map<string, { valor: ParametrosCola; vence: number }>();

export async function obtenerParametrosCola(instanciaId: string): Promise<ParametrosCola> {
  const ahora = Date.now();
  const cacheado = cacheParametros.get(instanciaId);
  if (cacheado && cacheado.vence > ahora) return cacheado.valor;

  let config = await prisma.configuracionAnalisisContactos.findUnique({
    where: { instanciaId },
    select: { ventanaAgrupacionSeg: true, esperaMaximaSeg: true },
  });
  if (!config) {
    // Una sola vez por cuenta; `skipDuplicates` absorbe la carrera entre réplicas.
    await prisma.configuracionAnalisisContactos.createMany({ data: [{ instanciaId }], skipDuplicates: true });
    config = { ventanaAgrupacionSeg: 300, esperaMaximaSeg: 1800 };
  }
  cacheParametros.set(instanciaId, { valor: config, vence: ahora + TTL_PARAMETROS_MS });
  return config;
}

export function invalidarParametrosCola(instanciaId: string): void {
  cacheParametros.delete(instanciaId);
}

// ── Marcar ─────────────────────────────────────────────────────────────────

export interface ParamsMarcar {
  instanciaId: string;
  contactoId: string;
  prioridad: PrioridadAnalisis;
  motivo: MotivoMarcado;
  tipo?: TipoEjecucionAnalisis;
  /** Salta la ventana de agrupación (P0). */
  inmediato?: boolean;
  /** Pedido explícito: va a la IA aunque no haya mensajes nuevos. */
  forzarIA?: boolean;
}

/**
 * Upsert de la fila de cola. Reglas (data-model.md "Reglas de marcarPendiente"):
 * versión + 1; la prioridad nunca baja; una fila EN_PROCESO sigue en proceso
 * (al completarse ve la versión nueva y vuelve a PENDIENTE); la ventana se
 * cuenta desde el primer marcado y nunca supera la espera máxima.
 *
 * El `SELECT ... FROM "Contacto" WHERE instanciaId` garantiza que no se marque
 * un contacto de otra cuenta aunque el llamador se equivoque de instancia.
 */
export async function marcarPendiente(p: ParamsMarcar): Promise<void> {
  const { ventanaAgrupacionSeg, esperaMaximaSeg } = await obtenerParametrosCola(p.instanciaId);
  const ventana = p.inmediato ? 0 : ventanaAgrupacionSeg;
  const espera = p.inmediato ? 0 : esperaMaximaSeg;
  const reabre = MOTIVOS_QUE_REABREN.includes(p.motivo);
  const tipo = p.tipo ?? (p.prioridad === "P2" ? "INICIAL" : "INCREMENTAL");

  await prisma.$executeRaw`
    INSERT INTO "ContactoAnalisisCola" (
      "id", "contactoId", "instanciaId", "estado", "prioridad", "tipo", "versionDatos", "forzarIA",
      "primerMarcadoEn", "elegibleDesde", "motivo", "intentos", "creadoEn", "actualizadoEn"
    )
    SELECT
      'cq' || replace(gen_random_uuid()::text, '-', ''), c."id", c."instanciaId", 'PENDIENTE',
      ${p.prioridad}::"PrioridadAnalisis", ${tipo}::"TipoEjecucionAnalisis", 1, ${p.forzarIA ?? false},
      now(), now() + make_interval(secs => ${ventana}), ${p.motivo}, 0, now(), now()
    FROM "Contacto" c
    WHERE c."id" = ${p.contactoId} AND c."instanciaId" = ${p.instanciaId}
    ON CONFLICT ("contactoId") DO UPDATE SET
      "versionDatos" = "ContactoAnalisisCola"."versionDatos" + 1,
      "prioridad" = CASE
        WHEN "ContactoAnalisisCola"."estado" IN ('AL_DIA') THEN EXCLUDED."prioridad"
        ELSE LEAST("ContactoAnalisisCola"."prioridad", EXCLUDED."prioridad") END,
      "tipo" = CASE
        WHEN "ContactoAnalisisCola"."estado" IN ('AL_DIA') THEN EXCLUDED."tipo"
        ELSE "ContactoAnalisisCola"."tipo" END,
      "forzarIA" = "ContactoAnalisisCola"."forzarIA" OR EXCLUDED."forzarIA",
      "estado" = CASE
        WHEN "ContactoAnalisisCola"."estado" = 'EN_PROCESO' THEN 'EN_PROCESO'::"EstadoColaAnalisis"
        WHEN "ContactoAnalisisCola"."estado" = 'FALLIDO' AND NOT ${reabre} THEN 'FALLIDO'::"EstadoColaAnalisis"
        ELSE 'PENDIENTE'::"EstadoColaAnalisis" END,
      "intentos" = CASE
        WHEN "ContactoAnalisisCola"."estado" = 'AL_DIA'
          OR ("ContactoAnalisisCola"."estado" = 'FALLIDO' AND ${reabre}) THEN 0
        ELSE "ContactoAnalisisCola"."intentos" END,
      "primerMarcadoEn" = CASE
        WHEN "ContactoAnalisisCola"."estado" = 'AL_DIA'
          OR ("ContactoAnalisisCola"."estado" = 'FALLIDO' AND ${reabre}) THEN now()
        ELSE COALESCE("ContactoAnalisisCola"."primerMarcadoEn", now()) END,
      "elegibleDesde" = CASE
        WHEN "ContactoAnalisisCola"."estado" = 'EN_PROCESO' THEN "ContactoAnalisisCola"."elegibleDesde"
        WHEN "ContactoAnalisisCola"."estado" = 'AL_DIA'
          OR ("ContactoAnalisisCola"."estado" = 'FALLIDO' AND ${reabre}) THEN now() + make_interval(secs => ${ventana})
        ELSE LEAST(
          "ContactoAnalisisCola"."elegibleDesde",
          now() + make_interval(secs => ${ventana}),
          COALESCE("ContactoAnalisisCola"."primerMarcadoEn", now()) + make_interval(secs => ${espera})
        ) END,
      "motivo" = EXCLUDED."motivo",
      "actualizadoEn" = now()`;
}

/**
 * Para los caminos calientes (mensajes, pedidos, actividades): un error al
 * marcar nunca debe romper la operación principal. Usa SIEMPRE el cliente
 * global —nunca el `tx` de quien llama— para que un fallo acá no aborte una
 * transacción ajena (tasks.md T027). Si esa transacción después hace
 * rollback, queda una marca de más: solo provoca una evaluación sin cambios.
 */
export async function marcarPendienteSinFallar(p: ParamsMarcar): Promise<void> {
  try {
    await marcarPendiente(p);
  } catch (err) {
    console.error("[analisis-contactos] No se pudo marcar el contacto como pendiente", {
      contactoId: p.contactoId,
      motivo: p.motivo,
      err,
    });
  }
}

// ── Reclamar ────────────────────────────────────────────────────────────────

export async function reclamarLote(p: {
  instanciaId: string;
  prioridad: PrioridadAnalisis;
  limite: number;
  leaseMs: number;
}): Promise<ContactoReclamado[]> {
  const bloqueadoHasta = new Date(Date.now() + p.leaseMs);
  const filas = await prisma.$queryRaw<
    Array<{ contactoId: string; versionReclamada: bigint; forzarIA: boolean; tipo: TipoEjecucionAnalisis; elegibleDesde: Date }>
  >`
    UPDATE "ContactoAnalisisCola"
    SET "estado" = 'EN_PROCESO', "versionReclamada" = "versionDatos", "bloqueadoHasta" = ${bloqueadoHasta}, "actualizadoEn" = now()
    WHERE "id" IN (
      SELECT "id" FROM "ContactoAnalisisCola"
      WHERE "instanciaId" = ${p.instanciaId}
        AND "estado" = 'PENDIENTE'
        AND "prioridad" = ${p.prioridad}::"PrioridadAnalisis"
        AND "elegibleDesde" <= now()
      ORDER BY "elegibleDesde" ASC
      LIMIT ${p.limite}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "contactoId", "versionReclamada", "forzarIA", "tipo", "elegibleDesde"`;
  return filas;
}

// ── Completar / devolver ───────────────────────────────────────────────────

type ClienteCola = Pick<Prisma.TransactionClient, "$executeRaw">;

/**
 * Cierra un contacto evaluado con éxito. Si llegaron datos nuevos mientras se
 * evaluaba (`versionDatos` ya no es la reclamada), vuelve a PENDIENTE para
 * evaluarse con esos datos (FR-011); si no, queda AL_DIA.
 */
export async function completarContacto(
  db: ClienteCola,
  p: { contactoId: string; versionReclamada: bigint; ejecucionId: string; datosHasta: Date | null },
): Promise<void> {
  await db.$executeRaw`
    UPDATE "ContactoAnalisisCola" SET
      "estado" = CASE WHEN "versionDatos" = "versionReclamada" THEN 'AL_DIA' ELSE 'PENDIENTE' END::"EstadoColaAnalisis",
      "prioridad" = CASE WHEN "versionDatos" = "versionReclamada" THEN 'P2'::"PrioridadAnalisis" ELSE "prioridad" END,
      "forzarIA" = CASE WHEN "versionDatos" = "versionReclamada" THEN false ELSE "forzarIA" END,
      "elegibleDesde" = CASE WHEN "versionDatos" = "versionReclamada" THEN "elegibleDesde" ELSE now() END,
      "primerMarcadoEn" = CASE WHEN "versionDatos" = "versionReclamada" THEN NULL ELSE "primerMarcadoEn" END,
      "intentos" = 0,
      "versionReclamada" = NULL,
      "bloqueadoHasta" = NULL,
      "ultimaEjecucionId" = ${p.ejecucionId},
      "datosHasta" = GREATEST("datosHasta", ${p.datosHasta}::timestamp(3)),
      "actualizadoEn" = now()
    WHERE "contactoId" = ${p.contactoId} AND "estado" = 'EN_PROCESO' AND "versionReclamada" = ${p.versionReclamada}`;
}

/** Espera antes del próximo intento: 30 s × 2^intentos, tope 30 min, jitter 0,8–1,2. */
export function calcularBackoffMs(intentos: number, aleatorio: number = Math.random()): number {
  const base = Math.min(BACKOFF_BASE_SEG * 2 ** Math.max(0, intentos), BACKOFF_TOPE_SEG) * 1000;
  return Math.round(base * (0.8 + 0.4 * Math.min(Math.max(aleatorio, 0), 1)));
}

/**
 * Devuelve contactos que no se pudieron evaluar. Con `MAX_INTENTOS` pasan a
 * FALLIDO (FR-035): se ven en el avance y solo una persona los reintenta.
 */
export async function devolverConBackoff(p: {
  instanciaId: string;
  contactoIds: string[];
  ejecucionId: string | null;
}): Promise<void> {
  if (p.contactoIds.length === 0) return;
  // La fórmula replica `calcularBackoffMs` en SQL para resolver todo el lote en una sentencia.
  await prisma.$executeRaw`
    UPDATE "ContactoAnalisisCola" SET
      "intentos" = "intentos" + 1,
      "estado" = CASE WHEN "intentos" + 1 >= ${MAX_INTENTOS} THEN 'FALLIDO' ELSE 'PENDIENTE' END::"EstadoColaAnalisis",
      "elegibleDesde" = now() + make_interval(secs => LEAST(${BACKOFF_BASE_SEG} * power(2, "intentos"), ${BACKOFF_TOPE_SEG}) * (0.8 + random() * 0.4)),
      "versionReclamada" = NULL,
      "bloqueadoHasta" = NULL,
      "ultimaEjecucionId" = COALESCE(${p.ejecucionId}, "ultimaEjecucionId"),
      "actualizadoEn" = now()
    WHERE "instanciaId" = ${p.instanciaId} AND "contactoId" IN (${Prisma.join(p.contactoIds)}) AND "estado" = 'EN_PROCESO'`;
}

/** Devuelve a PENDIENTE sin contar intento (el trabajo no llegó a hacerse, ej. sin presupuesto). */
export async function liberarSinIntento(instanciaId: string, contactoIds: string[]): Promise<void> {
  if (contactoIds.length === 0) return;
  await prisma.contactoAnalisisCola.updateMany({
    where: { instanciaId, contactoId: { in: contactoIds }, estado: "EN_PROCESO" },
    data: { estado: "PENDIENTE", versionReclamada: null, bloqueadoHasta: null },
  });
}

export async function reintentarFallidos(instanciaId: string): Promise<number> {
  const r = await prisma.contactoAnalisisCola.updateMany({
    where: { instanciaId, estado: "FALLIDO" },
    data: { estado: "PENDIENTE", intentos: 0, elegibleDesde: new Date(), primerMarcadoEn: new Date(), motivo: "MANUAL_REINTENTO" },
  });
  return r.count;
}

// ── Turnos por cuenta (planificador justo, research D2) ────────────────────

/**
 * Toma el turno de la cuenta que más tiempo lleva esperando (menor
 * `siguienteTurnoEn`) entre las que tienen trabajo elegible de esa prioridad
 * y lugar para otro lote. Avanza su turno (stride) y su contador de lotes en
 * la MISMA sentencia: con varios workers, `SKIP LOCKED` evita que dos tomen
 * la misma cuenta a la vez.
 *
 * No filtra por `habilitado`: una cuenta sin análisis con IA igual necesita
 * evaluación por reglas; eso lo decide el ejecutor.
 */
export async function tomarTurnoCuenta(p: {
  prioridad: PrioridadAnalisis;
  historicoPausadoGlobal: boolean;
  intervaloBaseMs: number;
  /** Solo para el simulador de carga: nunca toca cuentas reales. */
  soloInstancias?: string[];
}): Promise<{ instanciaId: string; tamanoLote: number } | null> {
  if (p.prioridad === "P2" && p.historicoPausadoGlobal) return null;
  const filtroInstancias = p.soloInstancias
    ? Prisma.sql`AND c."instanciaId" IN (${Prisma.join(p.soloInstancias)})`
    : Prisma.empty;
  const filas = await prisma.$queryRaw<Array<{ instanciaId: string; tamanoLote: number }>>`
    WITH elegida AS (
      SELECT c."id"
      FROM "ConfiguracionAnalisisContactos" c
      WHERE c."lotesEnCurso" < c."maxLotesSimultaneos"
        AND (${p.prioridad} <> 'P2' OR c."historicoPausado" = false)
        ${filtroInstancias}
        AND EXISTS (
          SELECT 1 FROM "ContactoAnalisisCola" q
          WHERE q."instanciaId" = c."instanciaId"
            AND q."estado" = 'PENDIENTE'
            AND q."prioridad" = ${p.prioridad}::"PrioridadAnalisis"
            AND q."elegibleDesde" <= now()
        )
      ORDER BY c."siguienteTurnoEn" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "ConfiguracionAnalisisContactos" c SET
      "siguienteTurnoEn" = GREATEST(c."siguienteTurnoEn", now()) + make_interval(secs => ${p.intervaloBaseMs / 1000}::double precision / GREATEST(c."peso", 1)),
      "lotesEnCurso" = c."lotesEnCurso" + 1
    FROM elegida
    WHERE c."id" = elegida."id"
    RETURNING c."instanciaId", c."tamanoLote"`;
  return filas[0] ?? null;
}

/** Devuelve el lugar del lote al terminar (o si el reclamo vino vacío). */
export async function liberarTurno(instanciaId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "ConfiguracionAnalisisContactos" SET "lotesEnCurso" = GREATEST("lotesEnCurso" - 1, 0)
    WHERE "instanciaId" = ${instanciaId}`;
}
