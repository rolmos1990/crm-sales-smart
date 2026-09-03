/**
 * Backfill de `ZonaEntregaUbicacion.nombreVisible`/`nombreNormalizado` para
 * las ubicaciones creadas antes de 024-alias-ubicaciones-transportistas
 * (research.md Decisión 3 / data-model.md).
 *
 * A diferencia del backfill de país (023 — heurística ambigua, puede quedar
 * "país pendiente"), este backfill es determinístico: siempre hay un valor
 * calculable a partir de columnas ya existentes (provinciaEstado,
 * distritoCiudad, corregimiento, sectorOCodigoPostal), así que no deja
 * ninguna fila sin completar.
 *
 * Idempotente y seguro de re-ejecutar: recalcula todas las filas con el
 * mismo criterio determinístico (mismo texto de entrada -> mismo resultado);
 * correrlo dos veces no cambia nada.
 *
 * Uso:
 *   npx tsx scripts/backfill-normalizar-ubicaciones.ts
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { construirNombreVisible, calcularNombreNormalizado } from "../src/sales/transportistas/zonas/normalizar";

// Subconjunto mínimo de Prisma Client que este script necesita — permite
// inyectar un mock en los tests sin depender del tipo completo generado.
interface UbicacionFila {
  id: string;
  provinciaEstado: string | null;
  distritoCiudad: string | null;
  corregimiento: string | null;
  sectorOCodigoPostal: string | null;
}

interface PrismaLike {
  zonaEntregaUbicacion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<UbicacionFila[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (args: any) => Promise<unknown>;
  };
}

// Pura — separada de ejecutarBackfill para poder testearla sin I/O.
export function calcularCamposNormalizados(
  ubicacion: Pick<UbicacionFila, "provinciaEstado" | "distritoCiudad" | "corregimiento" | "sectorOCodigoPostal">
): { nombreVisible: string; nombreNormalizado: string } {
  const nombreVisible = construirNombreVisible(ubicacion);
  return { nombreVisible, nombreNormalizado: calcularNombreNormalizado(nombreVisible) };
}

export async function ejecutarBackfill(prisma: PrismaLike) {
  const ubicaciones = await prisma.zonaEntregaUbicacion.findMany({
    select: { id: true, provinciaEstado: true, distritoCiudad: true, corregimiento: true, sectorOCodigoPostal: true },
  });

  let actualizadas = 0;

  for (const ubicacion of ubicaciones) {
    const { nombreVisible, nombreNormalizado } = calcularCamposNormalizados(ubicacion);
    await prisma.zonaEntregaUbicacion.update({ where: { id: ubicacion.id }, data: { nombreVisible, nombreNormalizado } });
    actualizadas += 1;
    console.log(`  ✓ ${ubicacion.id}: "${nombreVisible}" (${nombreNormalizado})`);
  }

  console.log(`\nListo: ${actualizadas} ubicaciones actualizadas.`);
  return { actualizadas };
}

async function main() {
  console.log("Backfill de nombreVisible/nombreNormalizado en ZonaEntregaUbicacion...\n");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    await ejecutarBackfill(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Solo corre al ejecutarse directamente (tsx scripts/...) — no al importarse
// desde un test, para poder testear calcularCamposNormalizados/ejecutarBackfill
// con un prisma inyectado sin tocar una base de datos real.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((err) => {
      console.error("Error en el backfill de normalización de ubicaciones:", err);
      process.exitCode = 1;
    });
}
