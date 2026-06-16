import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: npx tsx scripts/check-usuario.ts <email>");
    process.exit(1);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { instancias: { include: { instancia: true } } },
  });

  if (!usuario) {
    console.log(`No existe ningún Usuario con email: ${email}`);
  } else {
    console.log("USUARIO ENCONTRADO:");
    console.log(`  id:         ${usuario.id}`);
    console.log(`  email:      ${usuario.email}`);
    console.log(`  nombre:     ${usuario.nombre}`);
    console.log(`  rol:        ${usuario.rol}`);
    console.log(`  estado:     ${usuario.estado}`);
    console.log(`  authUserId: ${usuario.authUserId}`);
    console.log(`  creadoEn:   ${usuario.creadoEn}`);
    console.log(`  instancias: ${usuario.instancias.length}`);
    for (const ui of usuario.instancias) {
      console.log(`    - ${ui.instancia.nombre} (${ui.instancia.slug}) rol=${ui.rol} activo=${ui.activo}`);
    }
  }
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
