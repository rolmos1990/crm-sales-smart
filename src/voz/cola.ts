import { prisma } from "@/shared/db/prisma";
import { configEntornoVoz } from "./config-entorno";

/**
 * 049 — Cola durable de transcripciones.
 *
 * No hay tabla de cola: la fila de `MediaArchivo` ES la unidad de trabajo. Ya
 * es una fila por archivo y ya deduplica por hash, así que un audio reenviado
 * se transcribe —y se cobra— una sola vez, sin que haya que hacer nada.
 *
 * El reclamo usa `FOR UPDATE SKIP LOCKED` con lease, igual que
 * `src/crm/contactos/analisis/cola.ts` y que `reclamarJobs` de los
 * disparadores: dos workers nunca toman el mismo audio (FR-020) y un worker
 * caído suelta su trabajo al vencer el lease.
 *
 * ALCANCE: `marcarPendiente` exige `tipo IN ('AUDIO','NOTA_VOZ')` en el SQL,
 * no en TypeScript. Es el primer corte de los tres que impiden transcribir un
 * video — que en Instagram llega con el MISMO mime que una nota de voz. Ver
 * specs/049-proveedores-de-voz/contracts/alcance-transcripcion.md.
 */

export const MAX_INTENTOS = 5;
const BACKOFF_BASE_SEG = 30;
const BACKOFF_TOPE_SEG = 30 * 60;

export interface AudioReclamado {
  id: string;
  instanciaId: string;
  keyOriginal: string;
  mimeOriginal: string;
  nombreOriginal: string;
  pesoOriginal: number;
  intentos: number;
}

/**
 * Marca un archivo como pendiente de transcribir.
 *
 * El `WHERE` hace de guardia: solo pasa si el archivo está referenciado por un
 * mensaje AUDIO/NOTA_VOZ de esa instancia. El scope por `instanciaId` es la
 * garantía de tenant aunque el llamador se equivoque, igual que en 042.
 *
 * No toca filas que ya estén LISTO, INAUDIBLE o PROCESANDO: INAUDIBLE es
 * terminal y volver a marcarlo sería pagar otra vez por el mismo silencio.
 *
 * 051 — `reiniciarIntentos` pone el contador en cero. Por defecto **no**, y ese
 * default importa: un reintento normal tiene que seguir acumulando, porque es
 * lo que hace que el backoff y el tope de MAX_INTENTOS funcionen. Solo lo pide
 * una recuperación manual, donde los intentos previos fallaron por una causa ya
 * corregida y contarlos en contra dejaría al audio a un tropiezo de volver a
 * ERROR. Vive acá y no en el script para que las guardias —tenant, tipo de
 * mensaje, estados que no se tocan— sigan teniendo UNA sola definición en SQL.
 */
export async function marcarPendiente(p: {
  instanciaId: string;
  mediaArchivoId: string;
  reiniciarIntentos?: boolean;
}): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "MediaArchivo" ma SET
      "transcripcionEstado" = 'PENDIENTE'::"EstadoTranscripcion",
      "transcripcionBloqueadoHasta" = NULL,
      -- Una sola sentencia con el reinicio como parámetro, en vez de dos
      -- UPDATE casi iguales: las guardias de abajo tienen que tener UNA
      -- definición, que es la razón de que vivan en SQL y no en TypeScript.
      "transcripcionIntentos" = CASE
        WHEN ${p.reiniciarIntentos ?? false} THEN 0
        ELSE ma."transcripcionIntentos"
      END
    WHERE ma.id = ${p.mediaArchivoId}
      AND ma."instanciaId" = ${p.instanciaId}
      AND ma."transcripcionEstado" IN ('NO_APLICA', 'ERROR')
      AND EXISTS (
        SELECT 1 FROM "MensajeConversacion" m
        WHERE m."mediaArchivoId" = ma.id
          AND m.tipo IN ('AUDIO', 'NOTA_VOZ')
      )
  `;
}

/**
 * Igual que `marcarPendiente` pero no propaga el error.
 *
 * Se usa desde el camino caliente de recepción de mensajes: que no se pueda
 * encolar una transcripción no puede tumbar la recepción. Usa SIEMPRE el
 * cliente global, nunca el `tx` del llamador, para no abortar una transacción
 * ajena (mismo criterio que `marcarPendienteSinFallar` de 042).
 */
export async function marcarPendienteSinFallar(p: {
  instanciaId: string;
  mediaArchivoId: string;
}): Promise<void> {
  try {
    await marcarPendiente(p);
  } catch (e) {
    console.error("[voz] No se pudo encolar la transcripción:", e);
  }
}

/**
 * Reclama un lote de audios pendientes y elegibles, tomando el lease.
 *
 * El `EXISTS` se repite acá a propósito: una fila pudo quedar PENDIENTE por
 * una versión anterior del código o por una escritura manual, y el reclamo no
 * puede confiar en que el marcado la haya filtrado.
 */
export async function reclamarLote(p: {
  limite: number;
  leaseMs: number;
}): Promise<AudioReclamado[]> {
  const lease = new Date(Date.now() + p.leaseMs);

  return prisma.$queryRaw<AudioReclamado[]>`
    UPDATE "MediaArchivo" SET
      "transcripcionEstado" = 'PROCESANDO'::"EstadoTranscripcion",
      "transcripcionBloqueadoHasta" = ${lease}
    WHERE id IN (
      SELECT ma.id FROM "MediaArchivo" ma
      WHERE ma."transcripcionEstado" = 'PENDIENTE'
        AND (ma."transcripcionBloqueadoHasta" IS NULL OR ma."transcripcionBloqueadoHasta" <= now())
        AND EXISTS (
          SELECT 1 FROM "MensajeConversacion" m
          WHERE m."mediaArchivoId" = ma.id
            AND m.tipo IN ('AUDIO', 'NOTA_VOZ')
        )
      ORDER BY ma."creadoEn" ASC
      LIMIT ${p.limite}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "instanciaId", "keyOriginal", "mimeOriginal",
              "nombreOriginal", "pesoOriginal", "transcripcionIntentos" AS intentos
  `;
}

/**
 * Espera creciente con tope y jitter: 30 s × 2^intentos, techo 30 min.
 * El jitter evita que todos los audios de una caída vuelvan a la vez.
 */
export function calcularBackoffMs(intentos: number, aleatorio: number = Math.random()): number {
  const base = Math.min(BACKOFF_BASE_SEG * 2 ** Math.max(0, intentos), BACKOFF_TOPE_SEG) * 1000;
  return Math.round(base * (0.8 + 0.4 * Math.min(Math.max(aleatorio, 0), 1)));
}

/**
 * Devuelve audios que fallaron de forma recuperable. Al llegar a
 * `MAX_INTENTOS` pasan a ERROR y solo una persona los reintenta.
 */
export async function devolverConBackoff(mediaArchivoIds: string[]): Promise<void> {
  if (mediaArchivoIds.length === 0) return;
  // La fórmula replica `calcularBackoffMs` en SQL para resolver el lote entero
  // en una sentencia.
  await prisma.$executeRaw`
    UPDATE "MediaArchivo" SET
      "transcripcionIntentos" = "transcripcionIntentos" + 1,
      "transcripcionEstado" = CASE
        WHEN "transcripcionIntentos" + 1 >= ${MAX_INTENTOS} THEN 'ERROR'
        ELSE 'PENDIENTE'
      END::"EstadoTranscripcion",
      "transcripcionBloqueadoHasta" = now() + make_interval(
        secs => LEAST(${BACKOFF_BASE_SEG} * power(2, "transcripcionIntentos"), ${BACKOFF_TOPE_SEG})
                * (0.8 + random() * 0.4)
      )
    WHERE id = ANY(${mediaArchivoIds})
      AND "transcripcionEstado" = 'PROCESANDO'
  `;
}

/**
 * Marca un fallo NO reintentable (credencial inválida, formato rechazado).
 * Insistir gastaría cinco llamadas para terminar igual.
 */
export async function marcarErrorDefinitivo(mediaArchivoId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "MediaArchivo" SET
      "transcripcionEstado" = 'ERROR'::"EstadoTranscripcion",
      "transcripcionIntentos" = "transcripcionIntentos" + 1,
      "transcripcionBloqueadoHasta" = NULL
    WHERE id = ${mediaArchivoId}
  `;
}

/**
 * Saca de la cola un archivo que no corresponde transcribir.
 *
 * Es la salida del SEGUNDO corte de alcance: una fila marcada PENDIENTE cuyo
 * mensaje resulta ser un VIDEO vuelve a NO_APLICA sin llamar al proveedor.
 */
export async function marcarNoAplica(mediaArchivoId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "MediaArchivo" SET
      "transcripcionEstado" = 'NO_APLICA'::"EstadoTranscripcion",
      "transcripcionBloqueadoHasta" = NULL
    WHERE id = ${mediaArchivoId}
  `;
}

/** Recupera leases vencidos de un worker que murió a mitad del trabajo. */
export async function recuperarLeasesVencidos(): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "MediaArchivo" SET
      "transcripcionEstado" = 'PENDIENTE'::"EstadoTranscripcion",
      "transcripcionBloqueadoHasta" = NULL
    WHERE "transcripcionEstado" = 'PROCESANDO'
      AND "transcripcionBloqueadoHasta" IS NOT NULL
      AND "transcripcionBloqueadoHasta" <= now()
  `;
}

/** Lote por vuelta del barrido, según la configuración de plataforma. */
export function tamanoLote(): number {
  return configEntornoVoz().lote;
}
