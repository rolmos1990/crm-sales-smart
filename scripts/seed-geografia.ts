/**
 * Siembra el catálogo global de países y estados/provincias (ISO 3166-1 /
 * 3166-2) usado por la cobertura geográfica de transportistas y delivery
 * (019-cobertura-geografica-envios). Idempotente (upsert) y seguro de
 * re-ejecutar en producción — a diferencia de prisma/seed.ts, nunca borra
 * nada; Pais/EstadoProvincia son catálogo de referencia, no datos de un
 * tenant.
 *
 * Fuente de datos: `country-state-city` (devDependency, solo usada acá —
 * research.md Decisión 2b). codigoAlpha3 queda sin poblar por ahora: el
 * dataset de este paquete no lo trae; es un campo presentacional opcional,
 * no participa en ningún match de cobertura/costo.
 *
 * Uso:
 *   npm run db:seed:geografia
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Country, State } from "country-state-city";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const paises = Country.getAllCountries();
  console.log(`Sembrando catálogo geográfico: ${paises.length} países...\n`);

  let paisesCreados = 0;
  let estadosCreados = 0;

  for (const pais of paises) {
    const registro = await prisma.pais.upsert({
      where: { codigo: pais.isoCode },
      create: {
        codigo: pais.isoCode,
        nombre: pais.name,
        indicativoTelefonico: pais.phonecode ? `+${pais.phonecode}` : null,
        banderaEmoji: pais.flag ?? null,
      },
      update: {
        nombre: pais.name,
        indicativoTelefonico: pais.phonecode ? `+${pais.phonecode}` : null,
        banderaEmoji: pais.flag ?? null,
      },
      select: { id: true },
    });
    paisesCreados += 1;

    const estados = State.getStatesOfCountry(pais.isoCode);
    for (const estado of estados) {
      // Nombre único por país (schema @@unique([paisId, nombre])) — algunos
      // datasets traen duplicados exactos de nombre para el mismo país;
      // upsert los colapsa de forma segura en vez de fallar.
      await prisma.estadoProvincia.upsert({
        where: { paisId_nombre: { paisId: registro.id, nombre: estado.name } },
        create: { paisId: registro.id, nombre: estado.name, codigo: estado.isoCode ?? null },
        update: { codigo: estado.isoCode ?? null },
      });
      estadosCreados += 1;
    }

    if (estados.length > 0) {
      console.log(`  ✓ ${pais.flag ?? ""} ${pais.name} (${pais.isoCode}) — ${estados.length} estados/provincias`);
    }
  }

  console.log(`\nListo: ${paisesCreados} países, ${estadosCreados} estados/provincias sembrados/actualizados.`);
}

main()
  .catch((err) => {
    console.error("Error sembrando catálogo geográfico:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
