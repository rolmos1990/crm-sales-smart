/**
 * Migra campos personalizados del modelo antiguo (por stage) al nuevo (por pipeline).
 *
 * Antes: cada campo pertenecía a un stage específico (stageId requerido).
 * Después: cada campo pertenece al pipeline. Las etapas controlan comportamiento
 *          mediante visibleEn / requeridoEn / bloqueadoEn.
 *
 * Reglas de conversión:
 * - visibleEn = [stageId original]
 * - requeridoEn = [stageId original] si requerido era true
 * - bloqueadoEn = [stageId original] si bloqueado era true
 * - stageId queda null (el campo pasa a pertenecer solo al pipeline)
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const campos = await prisma.campoPersonalizado.findMany({
    where: {
      stageId: { not: null },
      pipelineId: { not: null },
    },
    select: {
      id: true,
      stageId: true,
      pipelineId: true,
      requerido: true,
      bloqueado: true,
      nombre: true,
      clave: true,
    },
  });

  if (campos.length === 0) {
    console.log("No hay campos con stageId para migrar.");
    return;
  }

  console.log(`Migrando ${campos.length} campo(s)...\n`);

  let migrados = 0;
  let omitidos = 0;

  for (const campo of campos) {
    if (!campo.stageId || !campo.pipelineId) { omitidos++; continue; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.campoPersonalizado as any).update({
      where: { id: campo.id },
      data: {
        stageId: null,
        visibleEn: [campo.stageId],
        requeridoEn: campo.requerido ? [campo.stageId] : [],
        bloqueadoEn: campo.bloqueado ? [campo.stageId] : [],
      },
    });

    console.log(`  [OK] "${campo.nombre}" (${campo.clave}) → pipeline ${campo.pipelineId}`);
    migrados++;
  }

  console.log(`\nResultado: ${migrados} migrados, ${omitidos} omitidos.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
