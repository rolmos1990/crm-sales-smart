import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Traer todas las conversaciones que no tienen ningún OportunidadConversacion
  const conversacionesSinVincular = await prisma.conversacion.findMany({
    where: { oportunidades: { none: {} } },
    select: { id: true, contactoId: true, instanciaId: true },
  });

  console.log(`Conversaciones sin oportunidad vinculada: ${conversacionesSinVincular.length}`);

  let vinculadas = 0;
  let sinOportunidad = 0;

  for (const conv of conversacionesSinVincular) {
    // Buscar oportunidad activa del contacto principal (ni ganada ni perdida)
    const opContacto = await prisma.oportunidadContacto.findFirst({
      where: {
        contactoId: conv.contactoId,
        principal: true,
        oportunidad: {
          ...(conv.instanciaId ? { instanciaId: conv.instanciaId } : {}),
          etapa: { notIn: ["GANADO", "PERDIDO"] },
          NOT: { stage: { OR: [{ esGanado: true }, { esPerdido: true }] } },
        },
      },
      select: { oportunidadId: true },
      orderBy: { oportunidad: { actualizadoEn: "desc" } },
    });

    if (!opContacto) {
      sinOportunidad++;
      continue;
    }

    await prisma.oportunidadConversacion.upsert({
      where: {
        oportunidadId_conversacionId: {
          oportunidadId: opContacto.oportunidadId,
          conversacionId: conv.id,
        },
      },
      create: { oportunidadId: opContacto.oportunidadId, conversacionId: conv.id },
      update: {},
    });
    vinculadas++;
  }

  console.log(`  ✓ Vinculadas: ${vinculadas}`);
  console.log(`  — Sin oportunidad activa: ${sinOportunidad}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
