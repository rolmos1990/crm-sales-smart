/**
 * Conciliación de documentos huérfanos en el vector store de OpenAI.
 *
 * 033-documentacion-vector-store-openai. Cada cuenta tiene su propio índice, y
 * un archivo que quedó ahí sin fila en `DocumentoAgenteIA` es más que un costo
 * de storage: es contenido vivo y consultable que ya nadie administra, y que
 * los agentes de esa cuenta pueden encontrar. Eso puede pasar si un borrado
 * falla a mitad, si se elimina un agente (que borra sus filas en cascada pero
 * no toca OpenAI) o si se borra una instancia entera.
 *
 * El script recorre los índices de todas las cuentas —leyéndolos de la base,
 * no del entorno—, lee la identidad de los atributos de cada archivo y borra
 * los que no corresponden a ningún documento vigente.
 *
 * Es idempotente: correrlo dos veces no cambia nada la segunda.
 *
 * Uso:
 *   npx tsx scripts/conciliar-documentos-huerfanos.ts            # solo informa
 *   npx tsx scripts/conciliar-documentos-huerfanos.ts --aplicar  # además borra
 *
 * Por defecto NO borra nada: el modo informe permite revisar la lista antes de
 * ejecutar un borrado irreversible sobre un índice compartido.
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { obtenerConfiguracionDocumentacion } from "../src/ai/documentacion/cliente-openai";

interface ArchivoRemoto {
  vectorStoreFileId: string;
  openaiFileId: string;
  vectorStoreId: string;
  documentoId: string | null;
  instanciaId: string | null;
}

export interface ResultadoConciliacion {
  revisados: number;
  vigentes: number;
  huerfanos: ArchivoRemoto[];
  /** Archivos sin identidad en sus atributos: no se puede saber de quién son. */
  sinIdentidad: ArchivoRemoto[];
  borrados: number;
  fallidos: number;
}

interface PrismaLike {
  documentoAgenteIA: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<Array<{ id: string }>>;
  };
  instancia: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<Array<{ id: string; vectorStoreDocumentacionId: string | null }>>;
  };
}

function atributo(attrs: Record<string, unknown> | null | undefined, clave: string): string | null {
  const valor = attrs?.[clave];
  return typeof valor === "string" && valor.length > 0 ? valor : null;
}

export async function conciliar(
  prisma: PrismaLike,
  opciones: { aplicar: boolean },
): Promise<ResultadoConciliacion> {
  const config = obtenerConfiguracionDocumentacion();
  if (!config) throw new Error("Falta OPENAI_DOCUMENTACION_API_KEY en el entorno.");

  // Un store por instancia: la lista sale de la base, no del entorno. Las
  // cuentas que nunca subieron un documento no tienen store y no se revisan.
  const instancias = await prisma.instancia.findMany({
    where: { vectorStoreDocumentacionId: { not: null } },
    select: { id: true, vectorStoreDocumentacionId: true },
  });
  const stores = instancias.map((i) => i.vectorStoreDocumentacionId!);

  if (stores.length === 0) {
    console.log("Ninguna cuenta tiene documentación cargada todavía.");
  }

  const remotos: ArchivoRemoto[] = [];

  for (const vectorStoreId of stores) {
    // El SDK pagina solo con el async iterator.
    for await (const archivo of config.client.vectorStores.files.list(vectorStoreId)) {
      const attrs = archivo.attributes as Record<string, unknown> | null;
      remotos.push({
        vectorStoreFileId: archivo.id,
        // El id de un vector store file ES el id del File de OpenAI: el
        // propio SDK nombra `fileID` al parámetro de `vectorStores.files.delete`
        // (resources/vector-stores/files.d.ts:32).
        openaiFileId: archivo.id,
        vectorStoreId,
        documentoId: atributo(attrs, "documentoId"),
        instanciaId: atributo(attrs, "instanciaId"),
      });
    }
  }

  const conIdentidad = remotos.filter((r) => r.documentoId !== null);
  const sinIdentidad = remotos.filter((r) => r.documentoId === null);

  // Una sola query contra todos los ids: el índice compartido puede tener
  // miles de archivos y preguntar uno por uno sería inviable.
  const vigentes = await prisma.documentoAgenteIA.findMany({
    where: { id: { in: conIdentidad.map((r) => r.documentoId!) } },
    select: { id: true },
  });
  const idsVigentes = new Set(vigentes.map((d) => d.id));

  const huerfanos = conIdentidad.filter((r) => !idsVigentes.has(r.documentoId!));

  let borrados = 0;
  let fallidos = 0;

  if (opciones.aplicar) {
    for (const h of huerfanos) {
      try {
        await config.client.vectorStores.files.delete(h.vectorStoreFileId, {
          vector_store_id: h.vectorStoreId,
        });
        await config.client.files.delete(h.openaiFileId);
        borrados++;
      } catch (err) {
        fallidos++;
        console.error(`  ✗ ${h.vectorStoreFileId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    revisados: remotos.length,
    vigentes: idsVigentes.size,
    huerfanos,
    sinIdentidad,
    borrados,
    fallidos,
  };
}

function informar(r: ResultadoConciliacion, aplicar: boolean): void {
  console.log(`\nArchivos en el índice:       ${r.revisados}`);
  console.log(`Con documento vigente:       ${r.vigentes}`);
  console.log(`Huérfanos:                   ${r.huerfanos.length}`);

  for (const h of r.huerfanos) {
    console.log(`  - ${h.vectorStoreFileId}  (documento ${h.documentoId}, instancia ${h.instanciaId})`);
  }

  if (r.sinIdentidad.length > 0) {
    // Importante no borrarlos a ciegas: un archivo sin atributos no se puede
    // atribuir a nadie, y tampoco es consultable (la verificación de
    // aislamiento lo descarta). Requiere decisión humana.
    console.log(`\n⚠ Sin identidad en sus atributos: ${r.sinIdentidad.length}`);
    console.log("  No se borran automáticamente. Revisalos en el dashboard de OpenAI:");
    for (const s of r.sinIdentidad) console.log(`  - ${s.vectorStoreFileId}`);
  }

  if (aplicar) {
    console.log(`\nBorrados: ${r.borrados}   Fallidos: ${r.fallidos}`);
  } else if (r.huerfanos.length > 0) {
    console.log("\nModo informe. Para borrarlos: --aplicar");
  }
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  console.log(
    aplicar
      ? "Conciliando documentos huérfanos (BORRANDO)...\n"
      : "Conciliando documentos huérfanos (solo informe)...\n",
  );

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    informar(await conciliar(prisma, { aplicar }), aplicar);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Error en la conciliación:", err);
    process.exitCode = 1;
  });
}
