import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createClient } from "@supabase/supabase-js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: npx tsx scripts/borrar-usuario.ts <email>");
    process.exit(1);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { instancias: { include: { instancia: true } } },
  });

  if (!usuario) {
    console.log(`No existe ningún Usuario con email: ${email}`);
  } else {
    for (const ui of usuario.instancias) {
      await prisma.instancia.delete({ where: { id: ui.instanciaId } });
      console.log(`✓ Instancia eliminada: ${ui.instancia.nombre} (${ui.instancia.slug})`);
    }
    await prisma.usuario.delete({ where: { email } });
    console.log(`✓ Usuario eliminado: ${email}`);

    if (usuario.authUserId) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(usuario.authUserId);
      if (error) {
        console.warn(`⚠ No se pudo eliminar de Supabase Auth: ${error.message}`);
      } else {
        console.log(`✓ Usuario eliminado de Supabase Auth (${usuario.authUserId})`);
      }
    }
  }

  console.log("\nListo. Puedes registrarte nuevamente.");
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
