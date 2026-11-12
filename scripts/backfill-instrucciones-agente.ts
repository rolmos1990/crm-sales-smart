/**
 * Backfill de `AgenteIAConfig.instruccionesAgente` para los agentes creados
 * antes de que el bloque único de instrucciones reemplazara a la
 * configuración por campos de 009-perfil-agente-estructurado-versionado.
 *
 * A cada agente sin instrucciones le genera el texto a partir de lo que ya
 * tenía configurado (rol, identidad, tono, comunicación, frases, reglas y
 * condiciones de transferencia), reutilizando las mismas funciones que arman
 * el prompt. El agente queda diciendo exactamente lo mismo que decía: el
 * objetivo del backfill es que nadie cambie de comportamiento el día que el
 * generador deje de leer esos campos.
 *
 * Correrlo ANTES de desplegar la UI nueva. Idempotente: solo toca agentes con
 * `instruccionesAgente IS NULL`; re-ejecutarlo no pisa a ninguno ya migrado
 * ni a uno editado a mano.
 *
 * Uso:
 *   npx tsx scripts/backfill-instrucciones-agente.ts
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generarInstruccionesDesdeConfig } from "../src/ai/prompt/migrar-instrucciones";
import type { ConfigAgenteParaPrompt } from "../src/ai/prompt/builder";

type AgentePendiente = ConfigAgenteParaPrompt & { id: string; usuario?: { nombre: string } | null };

// Subconjunto mínimo de Prisma Client que este script necesita — permite
// inyectar un mock en los tests sin depender del tipo completo generado.
interface PrismaLike {
  agenteIAConfig: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<AgentePendiente[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (args: any) => Promise<unknown>;
  };
}

const CAMPOS_ORIGEN = {
  id: true,
  objetivo: true,
  personalidad: true,
  especialidad: true,
  configuracionTono: true,
  nombreAgente: true,
  rol: true,
  idiomaPrincipal: true,
  idiomasPermitidos: true,
  longitudRespuesta: true,
  proactividad: true,
  intensidadComercial: true,
  estiloRecomendacion: true,
  frasesPreferidas: true,
  frasesProhibidas: true,
  comportamientosProhibidos: true,
  reglasPersonalizadas: true,
  condicionesTransferenciaHumano: true,
  usuario: { select: { nombre: true } },
} as const;

export async function ejecutarBackfill(prisma: PrismaLike) {
  const pendientes = await prisma.agenteIAConfig.findMany({
    where: { instruccionesAgente: null },
    select: CAMPOS_ORIGEN,
  });

  let migrados = 0;
  let sinContenido = 0;

  for (const agente of pendientes) {
    const instrucciones = generarInstruccionesDesdeConfig(agente);

    // No debería pasar (siempre se genera al menos el rol), pero un agente sin
    // nada que decir se deja como está antes que escribirle un texto vacío.
    if (!instrucciones.trim()) {
      sinContenido++;
      console.warn(`  · ${agente.usuario?.nombre ?? agente.id}: sin contenido migrable, se deja sin tocar`);
      continue;
    }

    await prisma.agenteIAConfig.update({
      where: { id: agente.id },
      data: { instruccionesAgente: instrucciones },
    });
    migrados++;
    console.log(`  ✓ ${agente.usuario?.nombre ?? agente.id}`);
  }

  console.log(`\nListo: ${migrados} agentes migrados, ${sinContenido} sin contenido migrable.`);
  return { migrados, sinContenido, total: pendientes.length };
}

async function main() {
  console.log("Backfill de instrucciones en agentes IA existentes...\n");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    await ejecutarBackfill(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Solo corre al ejecutarse directamente (tsx scripts/...) — no al importarse
// desde un test, para poder testear ejecutarBackfill con un prisma inyectado
// sin tocar una base de datos real.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Error en el backfill de instrucciones:", err);
    process.exitCode = 1;
  });
}
