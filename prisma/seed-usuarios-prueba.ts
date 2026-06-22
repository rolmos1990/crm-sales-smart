/**
 * Crea (o reusa) los 7 usuarios de prueba que usa `tests/setup/auth.setup.ts`
 * para hacer login con Playwright, todos en una misma Instancia de pruebas.
 *
 * Crea el usuario en Supabase Auth (admin.createUser) además de en la tabla
 * local Usuario, porque el login real valida contra Supabase Auth, no contra
 * Usuario.passwordHash (ver src/shared/auth/provider/supabase-provider.ts).
 *
 * Uso:
 *   npx tsx prisma/seed-usuarios-prueba.ts
 */
import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.test" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Rol } from "../src/generated/prisma/client";
import { crearSupabaseAdminClient } from "../src/shared/auth/provider/supabase-admin";
import { generarSlug } from "../src/shared/lib/slug";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const NOMBRE_INSTANCIA = "Instancia de Pruebas";
const PASSWORD = process.env.TEST_OWNER_PASSWORD;

const USUARIOS_PRUEBA: { rol: Rol; email: string | undefined }[] = [
  { rol: "OWNER", email: process.env.TEST_OWNER_EMAIL },
  { rol: "ADMIN", email: process.env.TEST_ADMIN_EMAIL },
  { rol: "AGENTE_VENTAS", email: process.env.TEST_AGENTE_VENTAS_EMAIL },
  { rol: "EJECUTIVO_VENTAS", email: process.env.TEST_EJECUTIVO_VENTAS_EMAIL },
  { rol: "SUPERVISOR", email: process.env.TEST_SUPERVISOR_EMAIL },
  { rol: "AGENTE_SOPORTE", email: process.env.TEST_AGENTE_SOPORTE_EMAIL },
  { rol: "INVITADO", email: process.env.TEST_INVITADO_EMAIL },
];

// Crea el usuario en Supabase Auth, o recupera su authUserId si ya existía.
async function obtenerOCrearAuthUserId(email: string): Promise<string> {
  const supabase = crearSupabaseAdminClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });

  if (!error && data.user) return data.user.id;

  // Si ya existe en Supabase Auth, buscarlo por email para reusar su id.
  const { data: { users }, error: errorLista } = await supabase.auth.admin.listUsers();
  if (errorLista) throw errorLista;

  const existente = users.find((u) => u.email === email);
  if (!existente) throw error ?? new Error(`No se pudo crear ni encontrar el usuario ${email} en Supabase Auth`);

  return existente.id;
}

async function main() {
  if (!PASSWORD) {
    console.error("Falta TEST_OWNER_PASSWORD en .env.test (se usa como password compartido de prueba).");
    process.exit(1);
  }

  const slug = generarSlug(NOMBRE_INSTANCIA);
  const instancia = await prisma.instancia.upsert({
    where: { slug },
    update: {},
    create: { nombre: NOMBRE_INSTANCIA, slug, estado: "ACTIVA" },
  });
  console.log(`✓ Instancia "${instancia.nombre}" (${instancia.slug})`);

  for (const { rol, email } of USUARIOS_PRUEBA) {
    if (!email) {
      console.warn(`⚠ Sin email configurado en .env.test para el rol ${rol}, se omite.`);
      continue;
    }

    const nombre = email.split("@")[0];
    const authUserId = await obtenerOCrearAuthUserId(email);

    const usuario = await prisma.usuario.upsert({
      where: { email },
      update: { authUserId, estado: "ACTIVO", rol },
      create: { nombre, email, authUserId, estado: "ACTIVO", rol, passwordHash: null },
    });

    await prisma.usuarioInstancia.upsert({
      where: { usuarioId_instanciaId: { usuarioId: usuario.id, instanciaId: instancia.id } },
      update: { activo: true, rol },
      create: { usuarioId: usuario.id, instanciaId: instancia.id, rol, activo: true },
    });

    console.log(`✓ ${rol.padEnd(17)} ${email}`);
  }

  console.log("\nListo. Los 7 usuarios de prueba ya pueden iniciar sesión en /login.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
