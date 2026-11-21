/**
 * 051 — Devuelve a la cola las notas de voz que murieron por FORMATO_NO_SOPORTADO.
 *
 * Groq y OpenAI rechazaban los audios porque el nombre de archivo no traía
 * extensión, y ese 400 se clasifica —bien— como fallo permanente: el audio
 * quedó en ERROR al primer intento, para siempre. Con el arreglo desplegado
 * esos audios se transcriben sin problema; lo único que falta es volver a
 * encolarlos.
 *
 * **Correr esto ANTES de desplegar el arreglo no sirve**: los audios vuelven a
 * fallar igual y se gastan llamadas pagas para nada.
 *
 * Es puntual, no un barrido automático. No hay nada que resucite errores solo:
 * los demás errores definitivos lo son por buenas razones.
 *
 * Uso:
 *   npx tsx scripts/051-recuperar-formato-no-soportado.ts
 *   npx tsx scripts/051-recuperar-formato-no-soportado.ts --instancia <id>
 *   npx tsx scripts/051-recuperar-formato-no-soportado.ts --aplicar
 */

import "../src/shared/env/cargar-env";
import { prisma } from "../src/shared/db/prisma";
import { marcarPendiente } from "../src/voz/cola";
import type { CodigoErrorVoz } from "../src/voz/proveedores/types";

/**
 * Tipado como `CodigoErrorVoz` a propósito: si el código se renombrara, esto
 * debe romper al compilar. Con una cadena suelta el script seguiría corriendo
 * y devolvería un "nada que recuperar" tranquilizador y falso.
 */
const CODIGO: CodigoErrorVoz = "FORMATO_NO_SOPORTADO";

interface Opciones {
  instanciaId: string | null;
  aplicar: boolean;
}

function leerOpciones(argv: string[]): Opciones {
  const i = argv.indexOf("--instancia");
  return {
    instanciaId: i >= 0 ? (argv[i + 1] ?? null) : null,
    // Por defecto NO escribe. Hay que pedir --aplicar a propósito: esto
    // termina costando dinero real en el proveedor.
    aplicar: argv.includes("--aplicar"),
  };
}

async function main() {
  const { instanciaId, aplicar } = leerOpciones(process.argv.slice(2));

  // El filtro por el código del fallo es lo que distingue ESTA causa de las
  // otras. Sin él se reintentarían errores que nadie diagnosticó.
  const candidatos = await prisma.$queryRaw<
    Array<{ id: string; instanciaId: string; nombreOriginal: string; intentos: number }>
  >`
    SELECT DISTINCT ma.id, ma."instanciaId", ma."nombreOriginal",
           ma."transcripcionIntentos" AS intentos
    FROM "MediaArchivo" ma
    JOIN "UsoVoz" u
      ON u."entidadTipo" = 'MediaArchivo'
     AND u."entidadId" = ma.id
     AND u.error = ${CODIGO}
    WHERE ma."transcripcionEstado" = 'ERROR'
      AND (${instanciaId}::text IS NULL OR ma."instanciaId" = ${instanciaId})
    ORDER BY ma.id
  `;

  if (candidatos.length === 0) {
    console.log("No hay notas de voz que recuperar por esta causa.");
    return;
  }

  const porCuenta = new Map<string, typeof candidatos>();
  for (const c of candidatos) {
    porCuenta.set(c.instanciaId, [...(porCuenta.get(c.instanciaId) ?? []), c]);
  }

  for (const [cuenta, filas] of porCuenta) {
    console.log(`[${cuenta}] ${filas.length} nota(s) de voz`);
    for (const f of filas) {
      console.log(`   ${f.id}  "${f.nombreOriginal}"  intentos=${f.intentos}`);
    }
  }

  if (!aplicar) {
    console.log(
      `\n${candidatos.length} nota(s) de voz se devolverían a la cola. ` +
        `No se escribió nada — volvé a correrlo con --aplicar.`,
    );
    return;
  }

  let recuperadas = 0;
  for (const c of candidatos) {
    // Reutiliza las guardias de la cola —tenant, tipo de mensaje, estados que
    // no se tocan— en vez de duplicarlas acá. `reiniciarIntentos` porque los
    // intentos previos fallaron por una causa que ya no existe.
    await marcarPendiente({
      instanciaId: c.instanciaId,
      mediaArchivoId: c.id,
      reiniciarIntentos: true,
    });
    recuperadas++;
  }

  console.log(
    `\n${recuperadas} nota(s) de voz devueltas a la cola. ` +
      `El worker las transcribe en su próxima vuelta, con el tope diario y el ` +
      `registro de uso de siempre.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
