/**
 * Backfill de `Transportista.paisId` para transportistas creados antes de
 * 023-transportistas-por-pais (research.md Decisión 4 / data-model.md).
 *
 * Para cada transportista sin país asignado, infiere el país a partir de los
 * países distintos entre las ubicaciones de las zonas con las que tiene
 * alguna tarifa (activa o no). Si hay exactamente un país distinto, lo
 * asigna; si hay cero o más de uno, lo deja sin asignar ("país pendiente" —
 * FR-008/FR-009, no bloquea el uso del transportista, solo agregarle zonas
 * o tarifas nuevas).
 *
 * Idempotente y seguro de re-ejecutar: solo toca transportistas con
 * `paisId IS NULL`; correrlo dos veces no modifica uno ya asignado —
 * mismo criterio que scripts/seed-geografia.ts.
 *
 * Uso:
 *   npx tsx scripts/backfill-pais-transportista.ts
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Subconjunto mínimo de Prisma Client que este script necesita — permite
// inyectar un mock en los tests sin depender del tipo completo generado.
// (`args: any` a propósito: el PrismaClient real tiene firmas de método
// mucho más específicas que una simple `unknown`, y por contravarianza de
// parámetros TS rechazaría asignarlo a esta interfaz si no se usa `any` acá).
interface PrismaLike {
  transportista: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<{ id: string; nombre: string }[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (args: any) => Promise<unknown>;
  };
  zonaEntregaUbicacion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<{ paisId: string }[]>;
  };
}

// Pura — sin país inferible cuando hay cero o más de un país distinto.
export function calcularPaisInferido(paisesDistintos: string[]): string | null {
  return paisesDistintos.length === 1 ? paisesDistintos[0] : null;
}

export async function listarPaisesDeZonasUsadas(prisma: PrismaLike, transportistaId: string): Promise<string[]> {
  const filas = await prisma.zonaEntregaUbicacion.findMany({
    where: { zonaEntrega: { tarifas: { some: { transportistaId } } } },
    select: { paisId: true },
    distinct: ["paisId"],
  });
  return filas.map((f) => f.paisId);
}

export async function ejecutarBackfill(prisma: PrismaLike) {
  const pendientes = await prisma.transportista.findMany({
    where: { paisId: null },
    select: { id: true, nombre: true },
  });

  let asignados = 0;
  let siguenPendientes = 0;

  for (const transportista of pendientes) {
    const paises = await listarPaisesDeZonasUsadas(prisma, transportista.id);
    const paisInferido = calcularPaisInferido(paises);

    if (paisInferido) {
      await prisma.transportista.update({ where: { id: transportista.id }, data: { paisId: paisInferido } });
      asignados += 1;
      console.log(`  ✓ ${transportista.nombre}: paisId asignado a ${paisInferido}`);
    } else {
      siguenPendientes += 1;
      console.log(`  · ${transportista.nombre}: sin país inferible, queda pendiente`);
    }
  }

  console.log(`\nListo: ${asignados} asignados automáticamente, ${siguenPendientes} pendientes.`);
  return { asignados, pendientes: siguenPendientes };
}

async function main() {
  console.log("Backfill de país en transportistas existentes...\n");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    await ejecutarBackfill(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Solo corre al ejecutarse directamente (tsx scripts/...) — no al importarse
// desde un test, para poder testear calcularPaisInferido/ejecutarBackfill
// con un prisma inyectado sin tocar una base de datos real.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((err) => {
      console.error("Error en el backfill de país:", err);
      process.exitCode = 1;
    });
}
