// Corrección puntual, se corre una sola vez tras desplegar
// 008-fix-facebook-messenger-reacciones (research.md R4, FR-005): las
// Páginas de Facebook Messenger conectadas antes de este cambio quedaron
// suscritas solo al campo "messages" — nunca reciben avisos de
// message_reactions hasta que se vuelva a llamar a la suscripción con la
// lista de campos actualizada. Este script lo hace por todas las cuentas ya
// conectadas, sin pedirle al usuario que reconecte nada manualmente.
//
// Requiere TOKENS_CIFRADO_KEY en el entorno (mismo que usa la app) para
// poder descifrar el accessToken guardado de cada cuenta.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { suscribirWebhookFacebookMessenger } from "../src/integraciones/facebook-messenger/conectar";
import { descifrarToken } from "../src/shared/lib/cifrado-tokens";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const cuentas = await prisma.cuentaCanal.findMany({
    where: { canal: "facebook_messenger", activa: true },
    select: { id: true, nombre: true, identificador: true, configuracion: true },
  });

  console.log(`Páginas de Facebook Messenger a resuscribir: ${cuentas.length}`);
  if (cuentas.length === 0) {
    await prisma.$disconnect();
    return;
  }

  for (const cuenta of cuentas) {
    const cfg = cuenta.configuracion as Record<string, unknown> & { accessToken?: string };
    if (!cfg.accessToken) {
      console.log(`  ⚠  "${cuenta.nombre}" (${cuenta.id}) sin accessToken configurado — se omite`);
      continue;
    }

    const accessToken = descifrarToken(cfg.accessToken);
    const resultado = await suscribirWebhookFacebookMessenger(cuenta.identificador, accessToken);

    if (resultado.success) {
      console.log(`  ✓  "${cuenta.nombre}" (Página ${cuenta.identificador}) → messages,message_reactions`);
    } else {
      console.log(`  ✗  "${cuenta.nombre}" (Página ${cuenta.identificador}) falló:`, resultado.error);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
