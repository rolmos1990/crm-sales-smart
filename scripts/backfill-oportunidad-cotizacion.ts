/**
 * Backfill del vínculo cotización → oportunidad que se perdía al editar.
 *
 * `obtenerDatosEdicionCotizacionAction` (el Sheet y el panel del Workspace) no
 * incluía `oportunidadId` en los valores iniciales del formulario. Como
 * FormCotizacion solo reenvía lo que recibe y actualizarCotizacion escribe lo
 * que le llega, abrir a editar una cotización nacida en el Pipeline le cortaba
 * el vínculo. Después el pedido nacía sin oportunidad y el disparador "Cerrar
 * oportunidad relacionada" no tenía a quién cerrar.
 *
 * Hace dos pasadas:
 *   1. Cotización sin oportunidad cuyo contacto tiene EXACTAMENTE una. Con dos
 *      o más no se adivina — se informa y se deja.
 *   2. Pedido sin oportunidad cuya cotización sí la tiene: generados antes de
 *      que generarPedidoDesdeCotizacion copiara el campo. Acá no hay nada que
 *      adivinar, solo propagar.
 *
 * Idempotente: solo toca `oportunidadId IS NULL`.
 *
 * Uso:
 *   npx tsx scripts/backfill-oportunidad-cotizacion.ts --dry-run
 *   npx tsx scripts/backfill-oportunidad-cotizacion.ts
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

interface PrismaLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cotizacion: { findMany: (args: any) => Promise<any[]>; update: (args: any) => Promise<unknown> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oportunidad: { findMany: (args: any) => Promise<any[]> };
  pedido: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<any[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateMany: (args: any) => Promise<{ count: number }>;
  };
}

export async function ejecutarBackfill(prisma: PrismaLike, opciones: { dryRun?: boolean } = {}) {
  const huerfanas = await prisma.cotizacion.findMany({
    where: { oportunidadId: null, contactoId: { not: null } },
    select: { id: true, numero: true, contactoId: true, instanciaId: true },
    orderBy: { creadoEn: "asc" },
  });

  let vinculadas = 0;
  let ambiguas = 0;
  let sinOportunidad = 0;

  for (const cot of huerfanas) {
    const ops = await prisma.oportunidad.findMany({
      where: { contactos: { some: { contactoId: cot.contactoId } }, instanciaId: cot.instanciaId },
      select: { id: true, titulo: true },
    });

    if (ops.length === 0) {
      sinOportunidad++;
      continue;
    }
    if (ops.length > 1) {
      ambiguas++;
      console.warn(`  ? ${cot.numero}: su contacto tiene ${ops.length} oportunidades — se deja sin tocar`);
      continue;
    }

    if (!opciones.dryRun) {
      await prisma.cotizacion.update({ where: { id: cot.id }, data: { oportunidadId: ops[0].id } });
      // El pedido ya generado hereda el vínculo que le faltaba.
      await prisma.pedido.updateMany({
        where: { cotizacionId: cot.id, oportunidadId: null },
        data: { oportunidadId: ops[0].id },
      });
    }
    vinculadas++;
    console.log(`  ${opciones.dryRun ? "·" : "✓"} ${cot.numero} → "${ops[0].titulo}"`);
  }

  // Segunda pasada: pedidos sin oportunidad cuya cotización SÍ la tiene. Son
  // los generados antes de que generarPedidoDesdeCotizacion copiara el campo
  // (ver el comentario "antes se perdía porque nunca se asignaba acá"). No
  // depende de la pasada anterior: la cotización ya tenía el vínculo y solo
  // falta propagarlo, así que no hay nada que adivinar.
  const pedidosHuerfanos = await prisma.pedido.findMany({
    where: { oportunidadId: null, cotizacion: { oportunidadId: { not: null } } },
    select: { id: true, numero: true, cotizacion: { select: { numero: true, oportunidadId: true } } },
    orderBy: { creadoEn: "asc" },
  });

  let pedidosVinculados = 0;
  for (const ped of pedidosHuerfanos) {
    const oportunidadId = ped.cotizacion?.oportunidadId;
    if (!oportunidadId) continue;
    if (!opciones.dryRun) {
      await prisma.pedido.updateMany({
        where: { id: ped.id, oportunidadId: null },
        data: { oportunidadId },
      });
    }
    pedidosVinculados++;
    console.log(`  ${opciones.dryRun ? "·" : "✓"} ${ped.numero} hereda la oportunidad de ${ped.cotizacion?.numero}`);
  }

  console.log(
    `\nListo: ${vinculadas} cotización(es) vinculada(s) · ${pedidosVinculados} pedido(s) propagado(s)` +
      `${opciones.dryRun ? " (dry-run, nada se escribió)" : ""}` +
      ` · ${ambiguas} ambigua(s) · ${sinOportunidad} sin oportunidad del contacto.`,
  );
  return { vinculadas, pedidosVinculados, ambiguas, sinOportunidad, total: huerfanas.length };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Backfill del vínculo cotización → oportunidad${dryRun ? " (dry-run)" : ""}...\n`);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    await ejecutarBackfill(prisma, { dryRun });
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Error en el backfill:", err);
    process.exitCode = 1;
  });
}
