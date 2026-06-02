import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Oportunidades en stage GANADO pero etapa ≠ GANADO
  const ganadas = await prisma.oportunidad.findMany({
    where: { stage: { esGanado: true }, NOT: { etapa: "GANADO" } },
    select: { id: true, titulo: true, etapa: true },
  });

  // Oportunidades en stage PERDIDO pero etapa ≠ PERDIDO
  const perdidas = await prisma.oportunidad.findMany({
    where: { stage: { esPerdido: true }, NOT: { etapa: "PERDIDO" } },
    select: { id: true, titulo: true, etapa: true },
  });

  console.log(`Oportunidades a corregir: ${ganadas.length} ganadas, ${perdidas.length} perdidas`);

  if (ganadas.length > 0) {
    await prisma.oportunidad.updateMany({
      where: { id: { in: ganadas.map((o) => o.id) } },
      data: { etapa: "GANADO" },
    });
    ganadas.forEach((o) => console.log(`  ✓ GANADO  "${o.titulo}" (era ${o.etapa})`));
  }

  if (perdidas.length > 0) {
    await prisma.oportunidad.updateMany({
      where: { id: { in: perdidas.map((o) => o.id) } },
      data: { etapa: "PERDIDO" },
    });
    perdidas.forEach((o) => console.log(`  ✓ PERDIDO "${o.titulo}" (era ${o.etapa})`));
  }

  if (ganadas.length === 0 && perdidas.length === 0) {
    console.log("  ✓ Todo consistente, nada que reparar.");
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
