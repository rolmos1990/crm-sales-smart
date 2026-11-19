/**
 * 042-contactos-analisis-ia — encola la clasificación inicial (research D16).
 *
 * Por cada cuenta, inserta una fila de cola P2/INICIAL para cada contacto que
 * todavía no tiene una, en páginas por cursor de id. Si un contacto va a la
 * IA o se resuelve solo por reglas lo decide el motor al procesarlo (plazo de
 * antigüedad de la cuenta, 12 meses por defecto).
 *
 * Idempotente: `ON CONFLICT ("contactoId") DO NOTHING`. Correrlo dos veces no
 * cambia nada la segunda vez.
 *
 * En producción, NO correrlo antes de tener el planificador justo (Historia
 * 4) y con `ANALISIS_CONTACTOS_HISTORICO_PAUSADO=false` (tasks.md, estrategia
 * de entrega). Con la pausa activa, las filas quedan creadas pero no se procesan.
 *
 * Uso:
 *   npm run db:backfill:analisis-contactos
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

export const TAMANO_PAGINA = 1000;

/**
 * Puro: avanza el cursor con los ids leídos. `null` = no hay más páginas
 * (la última vino incompleta).
 */
export function siguienteCursor(idsPagina: string[], tamanoPagina: number = TAMANO_PAGINA): string | null {
  if (idsPagina.length < tamanoPagina) return null;
  return idsPagina[idsPagina.length - 1] ?? null;
}

async function encolarCuenta(prisma: PrismaClient, instanciaId: string): Promise<{ leidos: number; insertados: number }> {
  let cursor: string | null = "";
  let leidos = 0;
  let insertados = 0;
  while (cursor !== null) {
    const ids: Array<{ id: string }> = await prisma.$queryRaw(Prisma.sql`
      SELECT "id" FROM "Contacto"
      WHERE "instanciaId" = ${instanciaId} AND "id" > ${cursor}
      ORDER BY "id" ASC
      LIMIT ${TAMANO_PAGINA}`);
    if (ids.length === 0) break;
    leidos += ids.length;
    insertados += await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "ContactoAnalisisCola" ("id", "contactoId", "instanciaId", "estado", "prioridad", "tipo", "motivo", "primerMarcadoEn", "elegibleDesde", "actualizadoEn")
      SELECT 'cq' || replace(gen_random_uuid()::text, '-', ''), c."id", c."instanciaId", 'PENDIENTE', 'P2', 'INICIAL', 'INICIAL', now(), now(), now()
      FROM "Contacto" c
      WHERE c."id" IN (${Prisma.join(ids.map((r) => r.id))})
      ON CONFLICT ("contactoId") DO NOTHING`);
    cursor = siguienteCursor(ids.map((r) => r.id));
  }
  return { leidos, insertados };
}

export async function encolarClasificacionInicial(prisma: PrismaClient): Promise<void> {
  const instancias = await prisma.instancia.findMany({ where: { estado: "ACTIVA" }, select: { id: true, nombre: true } });
  for (const inst of instancias) {
    // La configuración por cuenta la necesita el planificador; se crea con los valores por defecto.
    await prisma.configuracionAnalisisContactos.createMany({ data: [{ instanciaId: inst.id }], skipDuplicates: true });
    const r = await encolarCuenta(prisma, inst.id);
    console.log(`[042] ${inst.nombre}: ${r.leidos} contactos, ${r.insertados} encolados`);
  }
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    await encolarClasificacionInicial(prisma);
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
