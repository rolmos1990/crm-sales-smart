/**
 * Backfill de `Pedido.fechaEntrega` para los pedidos generados al aprobar una
 * cotización antes de que generarPedidoDesdeCotizacion lo copiara.
 *
 * `EntregaPedido.fechaEstimada` (seguimiento del envío) y `Pedido.fechaEntrega`
 * (columna "Entrega estimada" del listado, su filtro y los KPIs) son campos
 * distintos que deben mantenerse en sync. El servicio copiaba solo el primero,
 * así que esos pedidos muestran "—" en el listado y quedan fuera del filtro por
 * fecha de entrega aunque la cotización sí tuviera fecha.
 *
 * Solo toca pedidos con `fechaEntrega IS NULL` que tengan fecha en su entrega:
 * nunca pisa una fecha puesta a mano. Idempotente — re-ejecutarlo no cambia
 * nada.
 *
 * Uso:
 *   npx tsx scripts/backfill-fecha-entrega-pedido.ts            # aplica
 *   npx tsx scripts/backfill-fecha-entrega-pedido.ts --dry-run  # solo informa
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

interface PedidoPendiente {
  id: string;
  numero: string;
  // Opcional: el tipo base que genera Prisma para Pedido no incluye las
  // relaciones, y sin esto el PrismaClient real no encaja en PrismaLike
  // (mismo criterio que `usuario?` en backfill-instrucciones-agente.ts).
  entrega?: { fechaEstimada: Date | null } | null;
}

// Subconjunto mínimo de Prisma Client — permite inyectar un mock en los tests
// sin depender del tipo completo generado (mismo patrón que los otros backfills).
interface PrismaLike {
  pedido: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<PedidoPendiente[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (args: any) => Promise<unknown>;
  };
}

export async function ejecutarBackfill(prisma: PrismaLike, opciones: { dryRun?: boolean } = {}) {
  const pendientes = await prisma.pedido.findMany({
    where: {
      fechaEntrega: null,
      entrega: { fechaEstimada: { not: null } },
    },
    select: { id: true, numero: true, entrega: { select: { fechaEstimada: true } } },
    orderBy: { creadoEn: "asc" },
  });

  let actualizados = 0;

  for (const pedido of pendientes) {
    const fecha = pedido.entrega?.fechaEstimada;
    if (!fecha) continue; // el `where` ya lo excluye; defensivo ante un mock laxo

    if (!opciones.dryRun) {
      await prisma.pedido.update({ where: { id: pedido.id }, data: { fechaEntrega: fecha } });
    }
    actualizados++;
    console.log(`  ${opciones.dryRun ? "·" : "✓"} ${pedido.numero} → ${fecha.toISOString().slice(0, 10)}`);
  }

  console.log(
    `\nListo: ${actualizados} pedido(s) ${opciones.dryRun ? "a actualizar (dry-run, nada se escribió)" : "actualizados"}.`,
  );
  return { actualizados, total: pendientes.length };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Backfill de Pedido.fechaEntrega${dryRun ? " (dry-run)" : ""}...\n`);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    await ejecutarBackfill(prisma, { dryRun });
  } finally {
    await prisma.$disconnect();
  }
}

// Solo corre al ejecutarse directamente — no al importarse desde un test.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Error en el backfill de fecha de entrega:", err);
    process.exitCode = 1;
  });
}
