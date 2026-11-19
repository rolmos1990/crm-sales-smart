/**
 * 042-contactos-analisis-ia — línea base de consumo para SC-005 (C1).
 *
 * Correr ANTES de desplegar la bifurcación del perfil 012 (tasks.md): mide lo
 * que hoy cuesta interpretar contactos con la extracción por evento
 * (`UsoIA` con tarea EXTRACCION_ENTIDADES sobre contactos), para comparar
 * después contra el análisis por lotes. Solo agregados: sin ids ni nombres.
 *
 * Uso:
 *   npx tsx scripts/042-linea-base-consumo.ts [--dias 30]
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

export interface LineaBase {
  generadoEn: string;
  dias: number;
  cuentas: number;
  llamadas: number;
  contactosInterpretados: number;
  tokens: number;
  costoEstimado: number;
  tokensPorContacto: number | null;
  llamadasPorContacto: number | null;
}

/** Puro: arma el resumen a partir de los totales. */
export function resumirLineaBase(p: {
  dias: number;
  cuentas: number;
  llamadas: number;
  contactos: number;
  tokens: number;
  costo: number;
  ahora?: Date;
}): LineaBase {
  return {
    generadoEn: (p.ahora ?? new Date()).toISOString(),
    dias: p.dias,
    cuentas: p.cuentas,
    llamadas: p.llamadas,
    contactosInterpretados: p.contactos,
    tokens: p.tokens,
    costoEstimado: Math.round(p.costo * 10_000) / 10_000,
    tokensPorContacto: p.contactos > 0 ? Math.round(p.tokens / p.contactos) : null,
    llamadasPorContacto: p.contactos > 0 ? Math.round((p.llamadas / p.contactos) * 100) / 100 : null,
  };
}

async function main() {
  const i = process.argv.indexOf("--dias");
  const dias = i > 0 ? Number(process.argv[i + 1]) : 30;
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60_000);
    const donde = { tarea: "EXTRACCION_ENTIDADES" as const, entidadTipo: "contacto", creadoEn: { gte: desde } };
    const [totales, contactos, cuentas] = await Promise.all([
      prisma.usoIA.aggregate({ where: donde, _count: { _all: true }, _sum: { tokensInput: true, tokensOutput: true, costoEstimado: true } }),
      prisma.usoIA.findMany({ where: donde, select: { entidadId: true }, distinct: ["entidadId"] }),
      prisma.usoIA.findMany({ where: donde, select: { instanciaId: true }, distinct: ["instanciaId"] }),
    ]);
    const linea = resumirLineaBase({
      dias,
      cuentas: cuentas.length,
      llamadas: totales._count._all,
      contactos: contactos.length,
      tokens: (totales._sum.tokensInput ?? 0) + (totales._sum.tokensOutput ?? 0),
      costo: Number(totales._sum.costoEstimado ?? 0),
    });
    const destino = "specs/042-contactos-analisis-ia/linea-base-consumo.json";
    writeFileSync(destino, `${JSON.stringify(linea, null, 2)}\n`);
    console.log(`[042] Línea base guardada en ${destino}`, linea);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
