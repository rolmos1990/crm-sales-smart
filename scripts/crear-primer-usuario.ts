/**
 * Crea (o activa) el primer usuario administrador de una instancia (comercio).
 *
 * Requiere que el usuario ya exista en Supabase Auth (Dashboard → Authentication →
 * Users → Add user) para obtener su UUID (authUserId).
 *
 * Uso:
 *   npx tsx scripts/crear-primer-usuario.ts \
 *     --email admin@miempresa.com \
 *     --nombre "Ramon Olmos" \
 *     --auth-user-id <uuid-de-supabase> \
 *     --instancia "Mi Comercio"
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generarSlug } from "../src/shared/lib/slug";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function leerArgumento(nombre: string): string | undefined {
  const prefijo = `--${nombre}=`;
  const directo = process.argv.find((arg) => arg.startsWith(prefijo));
  if (directo) return directo.slice(prefijo.length);

  const indice = process.argv.indexOf(`--${nombre}`);
  if (indice !== -1) return process.argv[indice + 1];

  return undefined;
}

async function main() {
  const email = leerArgumento("email");
  const nombre = leerArgumento("nombre");
  const authUserId = leerArgumento("auth-user-id");
  const nombreInstancia = leerArgumento("instancia");

  if (!email || !nombre || !authUserId || !nombreInstancia) {
    console.error(
      "Uso: npx tsx scripts/crear-primer-usuario.ts --email <email> --nombre <nombre> --auth-user-id <uuid-supabase> --instancia <nombre-comercio>",
    );
    process.exit(1);
  }

  const slug = generarSlug(nombreInstancia);

  const instancia = await prisma.instancia.upsert({
    where: { slug },
    update: {},
    create: {
      nombre: nombreInstancia,
      slug,
      estado: "ACTIVA",
    },
  });
  console.log(`✓ Instancia "${instancia.nombre}" (${instancia.slug})`);

  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: {
      authUserId,
      estado: "ACTIVO",
      rol: "OWNER",
    },
    create: {
      nombre,
      email,
      authUserId,
      estado: "ACTIVO",
      rol: "OWNER",
      passwordHash: null,
    },
  });
  console.log(`✓ Usuario "${usuario.nombre}" <${usuario.email}> activo`);

  await prisma.usuarioInstancia.upsert({
    where: { usuarioId_instanciaId: { usuarioId: usuario.id, instanciaId: instancia.id } },
    update: { activo: true, rol: "OWNER" },
    create: {
      usuarioId: usuario.id,
      instanciaId: instancia.id,
      rol: "OWNER",
      activo: true,
    },
  });
  console.log(`✓ "${usuario.email}" vinculado a "${instancia.nombre}" como OWNER`);

  console.log("\nListo. Ya puedes iniciar sesión con este usuario en /login.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
