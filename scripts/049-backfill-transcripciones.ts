/**
 * 049 — Encola los audios históricos para transcribir.
 *
 * NO es una migración a propósito (FR-010): encender el interruptor no debe
 * producir un cargo retroactivo que nadie pidió. Transcribir lo viejo es una
 * decisión aparte y explícita.
 *
 * Parte de `MensajeConversacion` filtrando por `tipo`, NUNCA de
 * `MediaArchivo`: en Instagram una nota de voz y un video llegan los dos como
 * video/mp4, y Scribe transcribe video sin devolver error. Ver
 * specs/049-proveedores-de-voz/contracts/alcance-transcripcion.md.
 *
 * Uso:
 *   npx tsx scripts/049-backfill-transcripciones.ts --dry-run
 *   npx tsx scripts/049-backfill-transcripciones.ts --instancia <id>
 *   npx tsx scripts/049-backfill-transcripciones.ts --instancia <id> --aplicar
 */

import "../src/shared/env/cargar-env";
import { prisma } from "../src/shared/db/prisma";

interface Opciones {
  instanciaId: string | null;
  aplicar: boolean;
}

function leerOpciones(argv: string[]): Opciones {
  const i = argv.indexOf("--instancia");
  return {
    instanciaId: i >= 0 ? (argv[i + 1] ?? null) : null,
    // Por defecto NO escribe. Hay que pedir --aplicar a propósito: esto
    // cuesta dinero real.
    aplicar: argv.includes("--aplicar"),
  };
}

async function main() {
  const { instanciaId, aplicar } = leerOpciones(process.argv.slice(2));

  // Solo cuentas con la feature encendida y con un proveedor utilizable: si no,
  // se encolarían audios que nadie va a transcribir.
  const cuentas = await prisma.configuracionEmpresa.findMany({
    where: {
      transcripcionVozHabilitada: true,
      ...(instanciaId ? { instanciaId } : {}),
    },
    select: { instanciaId: true },
  });

  if (cuentas.length === 0) {
    console.log("No hay cuentas con la transcripción activada. Nada que hacer.");
    return;
  }

  let totalAudios = 0;
  let totalSegundos = 0;

  for (const { instanciaId: id } of cuentas) {
    const proveedores = await prisma.proveedorVoz.count({
      where: { instanciaId: id, activo: true, apiKeyEncriptada: { not: null } },
    });
    if (proveedores === 0) {
      console.log(`[${id}] sin proveedor de voz utilizable — se omite`);
      continue;
    }

    const candidatos = await prisma.$queryRaw<
      Array<{ mediaArchivoId: string; audios: number; segundos: number }>
    >`
      SELECT m."mediaArchivoId"        AS "mediaArchivoId",
             COUNT(*)::int             AS audios,
             COALESCE(MAX(m."mediaDuracion"), 0)::int AS segundos
      FROM "MensajeConversacion" m
      JOIN "Conversacion" c ON c.id = m."conversacionId"
      JOIN "MediaArchivo" ma ON ma.id = m."mediaArchivoId"
      WHERE c."instanciaId" = ${id}
        AND m.tipo IN ('AUDIO', 'NOTA_VOZ')
        AND m."mediaArchivoId" IS NOT NULL
        AND ma."transcripcionEstado" = 'NO_APLICA'
      GROUP BY m."mediaArchivoId"
    `;

    // La duración solo la tiene WhatsApp; para los de Instagram se estima por
    // el promedio medido (12,8 s) para poder informar un costo aproximado.
    const segundosEstimados = candidatos.reduce((n, c) => n + (c.segundos || 13), 0);

    console.log(
      `[${id}] ${candidatos.length} audios · ~${(segundosEstimados / 60).toFixed(1)} min`,
    );

    totalAudios += candidatos.length;
    totalSegundos += segundosEstimados;

    if (!aplicar || candidatos.length === 0) continue;

    const ids = candidatos.map((c) => c.mediaArchivoId);
    const r = await prisma.$executeRaw`
      UPDATE "MediaArchivo" SET
        "transcripcionEstado" = 'PENDIENTE'::"EstadoTranscripcion",
        "transcripcionBloqueadoHasta" = NULL
      WHERE id = ANY(${ids})
        AND "instanciaId" = ${id}
        AND "transcripcionEstado" = 'NO_APLICA'
    `;
    console.log(`[${id}] encolados: ${r}`);
  }

  const horas = totalSegundos / 3600;
  console.log(
    `\nTOTAL: ${totalAudios} audios · ${horas.toFixed(2)} h · ` +
      `costo aproximado a 0,20/hora: ${(horas * 0.2).toFixed(2)}`,
  );
  if (!aplicar) {
    console.log("\nSimulación. Para encolar de verdad, repetir con --aplicar.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
