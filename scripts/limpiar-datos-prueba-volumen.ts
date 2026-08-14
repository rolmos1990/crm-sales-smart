/**
 * Borra todo lo generado por `scripts/seed-datos-prueba-volumen.ts`.
 * Identifica los registros dummy por `metadata.seedDummy = true`.
 *
 * Borra: Oportunidad (cascada → OportunidadContacto), Contacto (cascada →
 * Conversacion → MensajeConversacion, ContactoIdentificadorCanal) y la
 * CuentaCanal dummy usada para agrupar las conversaciones de prueba.
 * No toca la Empresa "Suplenut" (es un dato real, no dummy).
 *
 * Uso:
 *   npx tsx scripts/limpiar-datos-prueba-volumen.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CUENTA_CANAL_DUMMY_ID_EXTERNO = "demo-dummy-seed";

async function main() {
  console.log("🧹 Borrando datos dummy de volumen (metadata.seedDummy = true)...\n");

  const oportunidades = await prisma.oportunidad.deleteMany({
    where: { metadata: { path: ["seedDummy"], equals: true } },
  });
  console.log(`✓ ${oportunidades.count} oportunidades eliminadas`);

  const contactos = await prisma.contacto.deleteMany({
    where: { metadata: { path: ["seedDummy"], equals: true } },
  });
  console.log(`✓ ${contactos.count} contactos eliminados (cascada: conversaciones, mensajes, identificadores)`);

  const cuenta = await prisma.cuentaCanal.deleteMany({
    where: { identificador: CUENTA_CANAL_DUMMY_ID_EXTERNO },
  });
  console.log(`✓ ${cuenta.count} cuenta(s) de canal dummy eliminada(s)`);

  console.log("\n✅ Limpieza completada. La Empresa \"Suplenut\" se conserva.");
}

main()
  .catch((e) => {
    console.error("❌ Error en limpieza:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
