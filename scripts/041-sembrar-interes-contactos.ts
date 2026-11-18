/**
 * 041-contactos-segmentacion-comercial — backfill y siembra, una sola vez.
 *
 * Por cada instancia:
 *   1. `Contacto.ultimaInteraccionEn` = lo más reciente entre mensajes del
 *      contacto o enviados desde la app nativa del canal (no notas internas),
 *      actividades que NO creó un Workflow ni un disparador, y pedidos.
 *      Los mensajes AGENTE históricos se excluyen porque no se puede saber si
 *      los escribió una persona o la IA (research.md D4): en el peor caso
 *      adelanta un "Pendiente", preferible a esconder contactos detrás de
 *      respuestas automáticas.
 *   2. `Contacto.esperandoRespuestaDesde` = fecha del último mensaje no nota y
 *      no SISTEMA del contacto, si ese mensaje lo escribió el contacto.
 *   3. `Contacto.nivelInteres` sembrado desde la intención comercial que el
 *      perfil 012 ya interpretó (tabla EQUIVALENCIA_INTENCION), con origen IA,
 *      sin fijar, y una fila de historial por contacto.
 *
 * Idempotente: cada paso solo toca filas todavía nulas. Correrlo dos veces no
 * cambia nada la segunda vez.
 *
 * Uso:
 *   npm run db:backfill:contactos-segmentacion
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

type NivelSembrado = "ALTO" | "MEDIO" | "BAJO";

/**
 * Intención comercial (012) → nivel de interés (041). Las intenciones que no
 * dicen nada sobre ganas de comprar (`REQUIERE_ATENCION_HUMANA`) quedan sin
 * evaluar. Documentada en research.md D10.
 */
export const EQUIVALENCIA_INTENCION: Record<string, NivelSembrado | null> = {
  LISTO_PARA_COMPRAR: "ALTO",
  LISTO_PARA_COTIZAR: "ALTO",
  CONSULTANDO_PRECIO: "MEDIO",
  CONSULTANDO_DISPONIBILIDAD: "MEDIO",
  COMPARANDO: "MEDIO",
  SOLICITANDO_RECOMENDACION: "MEDIO",
  REQUIERE_SEGUIMIENTO: "MEDIO",
  ESPERANDO_INFORMACION: "MEDIO",
  EXPLORANDO: "BAJO",
  REQUIERE_ATENCION_HUMANA: null,
};

export function nivelDesdeIntencion(intencion: unknown): NivelSembrado | null {
  return typeof intencion === "string" ? (EQUIVALENCIA_INTENCION[intencion] ?? null) : null;
}

const LOTE = 500;

async function backfillUltimaInteraccion(prisma: PrismaClient, instanciaId: string): Promise<number> {
  return prisma.$executeRaw(Prisma.sql`
    UPDATE "Contacto" c
    SET "ultimaInteraccionEn" = x.maxf
    FROM (
      SELECT c2.id, GREATEST(
        (SELECT MAX(m."creadoEn")
           FROM "MensajeConversacion" m
           JOIN "Conversacion" cv ON cv.id = m."conversacionId"
          WHERE cv."contactoId" = c2.id
            AND m."esNotaInterna" = false
            AND m.remitente IN ('CONTACTO', 'AGENTE_CANAL_NATIVO')),
        (SELECT MAX(a."creadoEn")
           FROM "Actividad" a
          WHERE a."contactoId" = c2.id
            AND (a.metadata IS NULL OR NOT (jsonb_exists(a.metadata, 'workflowEjecucionId') OR jsonb_exists(a.metadata, 'disparadorId')))),
        (SELECT MAX(p."creadoEn") FROM "Pedido" p WHERE p."contactoId" = c2.id)
      ) AS maxf
      FROM "Contacto" c2
      WHERE c2."instanciaId" = ${instanciaId} AND c2."ultimaInteraccionEn" IS NULL
    ) x
    WHERE c.id = x.id AND x.maxf IS NOT NULL
  `);
}

async function backfillEsperandoRespuesta(prisma: PrismaClient, instanciaId: string): Promise<number> {
  return prisma.$executeRaw(Prisma.sql`
    UPDATE "Contacto" c
    SET "esperandoRespuestaDesde" = x."creadoEn"
    FROM (
      SELECT DISTINCT ON (cv."contactoId") cv."contactoId", m.remitente, m."creadoEn"
        FROM "MensajeConversacion" m
        JOIN "Conversacion" cv ON cv.id = m."conversacionId"
       WHERE cv."instanciaId" = ${instanciaId}
         AND m."esNotaInterna" = false
         AND m.remitente <> 'SISTEMA'
       ORDER BY cv."contactoId", m."creadoEn" DESC
    ) x
    WHERE c.id = x."contactoId"
      AND x.remitente = 'CONTACTO'
      AND c."esperandoRespuestaDesde" IS NULL
  `);
}

async function sembrarInteres(prisma: PrismaClient, instanciaId: string): Promise<number> {
  let sembrados = 0;
  let cursor: string | undefined;
  for (;;) {
    const lote = await prisma.contacto.findMany({
      where: { instanciaId, nivelInteresOrigen: null, perfilCliente: { isNot: null } },
      select: { id: true, perfilCliente: { select: { datosInterpretados: true } } },
      orderBy: { id: "asc" },
      take: LOTE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (lote.length === 0) break;
    cursor = lote[lote.length - 1].id;

    for (const c of lote) {
      const interpretado = c.perfilCliente?.datosInterpretados as { intencionComercialActual?: unknown } | null;
      const nivel = nivelDesdeIntencion(interpretado?.intencionComercialActual);
      if (!nivel) continue;
      const ahora = new Date();
      await prisma.$transaction([
        prisma.contacto.updateMany({
          // Re-chequeo: si alguien lo clasificó a mano mientras corría, no se pisa.
          where: { id: c.id, nivelInteresOrigen: null },
          data: { nivelInteres: nivel, nivelInteresOrigen: "IA", nivelInteresFijado: false, nivelInteresActualizadoEn: ahora },
        }),
        prisma.contactoClasificacionHistorial.create({
          data: {
            dimension: "INTERES",
            valorAnterior: "SIN_EVALUAR",
            valorNuevo: nivel,
            fijado: false,
            origen: "IA",
            contactoId: c.id,
            instanciaId,
          },
        }),
      ]);
      sembrados++;
    }
  }
  return sembrados;
}

export async function ejecutar(prisma: PrismaClient): Promise<void> {
  const instancias = await prisma.instancia.findMany({ select: { id: true } });
  for (const { id } of instancias) {
    const interaccion = await backfillUltimaInteraccion(prisma, id);
    const espera = await backfillEsperandoRespuesta(prisma, id);
    const interes = await sembrarInteres(prisma, id);
    console.log(`[041] instancia ${id}: última interacción ${interaccion}, esperando respuesta ${espera}, interés sembrado ${interes}`);
  }
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    await ejecutar(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
