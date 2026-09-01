/**
 * Backfill único: resuelve `ConfiguracionEmpresa.pais` (texto libre,
 * histórico) contra el catálogo `Pais` nuevo, para que los negocios
 * existentes no tengan que reconfigurar manualmente su modo geográfico
 * (019-cobertura-geografica-envios, data-model.md "Nota de migración").
 *
 * - Match encontrado  → modoGeografico = UN_SOLO_PAIS, paisOperacionId = ese país.
 * - Sin match / sin `pais` cargado → se deja en MULTIPAIS (el default de
 *   schema), el negocio configura explícitamente después (T040).
 *
 * Idempotente y seguro de re-ejecutar: solo toca instancias cuyo
 * `paisOperacionId` sigue en null (nunca pisa una elección ya hecha por un
 * negocio vía la UI de configuración geográfica).
 *
 * Uso:
 *   npx tsx scripts/migrar-configuracion-geografica.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generarSlug } from "../src/shared/lib/slug";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const configuraciones = await prisma.configuracionEmpresa.findMany({
    where: { paisOperacionId: null, pais: { not: null } },
    select: { id: true, instanciaId: true, pais: true },
  });

  console.log(`Revisando ${configuraciones.length} instancias con país cargado y sin modo geográfico configurado...\n`);

  // Comparación por slug (sin tildes/mayúsculas): el catálogo sembrado usa
  // nombres en inglés sin diacríticos (ej. "Panama"), el negocio escribió
  // "Panamá" — un match exacto/case-insensitive nunca encontraría nada.
  const todosLosPaises = await prisma.pais.findMany({ select: { id: true, nombre: true } });

  let resueltas = 0;
  let sinMatch = 0;

  for (const config of configuraciones) {
    const nombrePais = config.pais!.trim();
    const slugBuscado = generarSlug(nombrePais);
    const pais = todosLosPaises.find((p) => generarSlug(p.nombre) === slugBuscado);

    if (!pais) {
      sinMatch += 1;
      console.log(`  ✗ Instancia ${config.instanciaId}: "${nombrePais}" no coincide con ningún país del catálogo — queda en MULTIPAIS`);
      continue;
    }

    await prisma.configuracionEmpresa.update({
      where: { id: config.id },
      data: { modoGeografico: "UN_SOLO_PAIS", paisOperacionId: pais.id },
    });
    resueltas += 1;
    console.log(`  ✓ Instancia ${config.instanciaId}: "${nombrePais}" → ${pais.nombre} (UN_SOLO_PAIS)`);
  }

  console.log(`\nListo: ${resueltas} instancias resueltas a UN_SOLO_PAIS, ${sinMatch} sin match (quedan en MULTIPAIS).`);
}

main()
  .catch((err) => {
    console.error("Error en la migración de configuración geográfica:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
