import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Encontrar oportunidades sin pipeline
  const huerfanas = await prisma.oportunidad.findMany({
    where: { pipelineId: null },
    select: { id: true, titulo: true, instanciaId: true },
  });

  console.log(`Oportunidades sin pipeline: ${huerfanas.count ?? huerfanas.length}`);
  if (huerfanas.length === 0) { await prisma.$disconnect(); return; }

  // Encontrar el mejor pipeline disponible por instanciaId
  for (const op of huerfanas) {
    const pipeline =
      (op.instanciaId
        ? await prisma.pipeline.findFirst({
            where: { instanciaId: op.instanciaId, activo: true },
            orderBy: [{ esDefault: "desc" }, { creadoEn: "asc" }],
            include: { stages: { where: { esInicial: true, activo: true }, orderBy: { orden: "asc" }, take: 1 } },
          })
        : null) ??
      await prisma.pipeline.findFirst({
        where: { activo: true },
        orderBy: [{ esDefault: "desc" }, { creadoEn: "asc" }],
        include: { stages: { where: { esInicial: true, activo: true }, orderBy: { orden: "asc" }, take: 1 } },
      });

    if (!pipeline) {
      console.log(`  ⚠  Sin pipeline disponible para "${op.titulo}" (${op.id})`);
      continue;
    }

    const stageInicial = pipeline.stages[0] ?? null;
    await prisma.oportunidad.update({
      where: { id: op.id },
      data: {
        pipelineId: pipeline.id,
        stageId: stageInicial?.id ?? null,
        probabilidad: stageInicial?.probabilidad ?? 20,
      },
    });
    console.log(`  ✓  "${op.titulo}" → pipeline "${pipeline.nombre}" / stage "${stageInicial?.nombre ?? "ninguno"}"`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
