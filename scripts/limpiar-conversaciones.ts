import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const convs = await prisma.conversacion.deleteMany({});
  console.log("Conversaciones eliminadas:", convs.count);

  const ops = await prisma.oportunidad.updateMany({ data: { nuevoMensaje: false } });
  console.log("Flags nuevoMensaje reseteados:", ops.count);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
