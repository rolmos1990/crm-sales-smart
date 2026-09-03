/**
 * Backfill de `ServicioTransportista`/`CondicionesTransportista` para
 * transportistas creados antes de 022-transportistas-zonas-tarifas.
 *
 * `crearTransportista()` siembra 3 servicios (Estándar/Express/Personalizado)
 * y una fila de condiciones por defecto al crear un transportista nuevo,
 * pero eso solo aplica a partir de que esa lógica se agregó — los
 * transportistas ya existentes en ese momento se quedaron sin ninguno de
 * los dos, y por eso "Servicio" aparece vacío en los diálogos de tarifa
 * (Nueva/Editar) para esos registros.
 *
 * Idempotente y seguro de re-ejecutar: solo toca transportistas con 0
 * servicios y/o sin condiciones; uno ya sembrado no vuelve a tocarse.
 *
 * Uso:
 *   npx tsx scripts/backfill-servicios-condiciones-transportista.ts
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SERVICIOS_TRANSPORTISTA_INICIALES, CONDICIONES_POR_DEFECTO } from "../src/sales/transportistas/types";

// Subconjunto mínimo de Prisma Client que este script necesita — permite
// inyectar un mock en los tests sin depender del tipo completo generado.
interface PrismaLike {
  transportista: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<{ id: string; nombre: string; _count: { servicios: number }; condiciones: { id: string } | null }[]>;
  };
  servicioTransportista: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createMany: (args: any) => Promise<unknown>;
  };
  condicionesTransportista: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (args: any) => Promise<unknown>;
  };
}

export async function ejecutarBackfill(prisma: PrismaLike) {
  const transportistas = await prisma.transportista.findMany({
    select: { id: true, nombre: true, _count: { select: { servicios: true } }, condiciones: { select: { id: true } } },
  });

  let serviciosSembrados = 0;
  let condicionesSembradas = 0;

  for (const t of transportistas) {
    if (t._count.servicios === 0) {
      await prisma.servicioTransportista.createMany({
        data: SERVICIOS_TRANSPORTISTA_INICIALES.map((nombre) => ({ transportistaId: t.id, nombre })),
      });
      serviciosSembrados += 1;
      console.log(`  ✓ ${t.nombre}: 3 servicios sembrados (Estándar/Express/Personalizado)`);
    }

    if (!t.condiciones) {
      await prisma.condicionesTransportista.create({ data: { transportistaId: t.id, ...CONDICIONES_POR_DEFECTO } });
      condicionesSembradas += 1;
      console.log(`  ✓ ${t.nombre}: condiciones por defecto sembradas`);
    }
  }

  console.log(`\nListo: ${serviciosSembrados} transportistas con servicios sembrados, ${condicionesSembradas} con condiciones sembradas.`);
  return { serviciosSembrados, condicionesSembradas };
}

async function main() {
  console.log("Backfill de servicios/condiciones en transportistas existentes...\n");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    // El cliente real de Prisma no tipa su retorno según el `select` en
    // tiempo de ejecución (a diferencia de PrismaLike, pensado para poder
    // inyectar un mock en los tests) — cast explícito y acotado a este punto.
    await ejecutarBackfill(prisma as unknown as PrismaLike);
  } finally {
    await prisma.$disconnect();
  }
}

// Solo corre al ejecutarse directamente (tsx scripts/...) — no al importarse
// desde un test.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((err) => {
      console.error("Error en el backfill de servicios/condiciones:", err);
      process.exitCode = 1;
    });
}
