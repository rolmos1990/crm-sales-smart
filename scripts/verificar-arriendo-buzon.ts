// Verificación del arrendamiento de lectura CONTRA LA BASE REAL.
//
// No es un test de vitest a propósito: lo que hay que probar es justamente el
// comportamiento a través del pooler, y un mock no lo reproduce. El bug
// anterior (pg_try_advisory_lock) pasaba todos los tests unitarios y fallaba
// solo contra la base de producción.
//
//   npx tsx scripts/verificar-arriendo-buzon.ts
import "../src/shared/env/cargar-env";
import { prisma } from "../src/shared/db/prisma";
import { soltarArriendo, tomarArriendo } from "../src/integraciones/email/imap/polling";

function comprobar(descripcion: string, condicion: boolean) {
  console.log(`  ${condicion ? "✓" : "✗"} ${descripcion}`);
  if (!condicion) process.exitCode = 1;
}

async function main() {
  const buzon = await prisma.cuentaCanal.findFirst({
    where: { canal: "email" },
    select: { id: true, instanciaId: true, identificador: true },
  });
  if (!buzon) {
    console.log("No hay ningún buzón de correo registrado; nada que verificar.");
    return;
  }

  console.log(`\nBuzón: ${buzon.identificador}\n`);
  await prisma.buzonCorreoEstado.upsert({
    where: { cuentaCanalId: buzon.id },
    create: { cuentaCanalId: buzon.id, instanciaId: buzon.instanciaId },
    update: {},
  });
  await soltarArriendo(buzon.id);

  comprobar("se puede tomar el arriendo estando libre", await tomarArriendo(buzon.id));

  // ESTA es la que fallaba con pg_try_advisory_lock a través del pooler:
  // devolvía true porque la segunda consulta caía en otro backend.
  comprobar("un segundo intento NO lo obtiene", (await tomarArriendo(buzon.id)) === false);

  await soltarArriendo(buzon.id);
  comprobar("tras soltarlo se puede volver a tomar", await tomarArriendo(buzon.id));
  await soltarArriendo(buzon.id);

  const tras = await prisma.buzonCorreoEstado.findUnique({
    where: { cuentaCanalId: buzon.id },
    select: { leyendoDesde: true },
  });
  comprobar("al soltarlo la fila queda libre", tras?.leyendoDesde === null);

  // Un worker muerto a mitad de lectura no debe dejar el buzón trabado.
  await prisma.$executeRaw`
    UPDATE "BuzonCorreoEstado"
       SET "leyendoDesde" = now() - interval '10 minutes'
     WHERE "cuentaCanalId" = ${buzon.id}`;
  comprobar("un arriendo vencido se puede reclamar", await tomarArriendo(buzon.id));
  await soltarArriendo(buzon.id);

  console.log(
    process.exitCode === 1 ? "\nHAY FALLOS\n" : "\nTodo correcto: el arriendo funciona por el pooler.\n",
  );
  await prisma.$disconnect();
}

main();
