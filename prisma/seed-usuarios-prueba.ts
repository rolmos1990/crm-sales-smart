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

const STAGES_DEFAULT = [
  { nombre: "Prospecto",   orden: 0, probabilidad: 10,  esInicial: true,  esGanado: false, esPerdido: false, color: "#818cf8" },
  { nombre: "Calificado",  orden: 1, probabilidad: 25,  esInicial: false, esGanado: false, esPerdido: false, color: "#22d3ee" },
  { nombre: "Propuesta",   orden: 2, probabilidad: 50,  esInicial: false, esGanado: false, esPerdido: false, color: "#fbbf24" },
  { nombre: "Negociación", orden: 3, probabilidad: 75,  esInicial: false, esGanado: false, esPerdido: false, color: "#f97316" },
  { nombre: "Ganado",      orden: 4, probabilidad: 100, esInicial: false, esGanado: true,  esPerdido: false, color: "#4ade80" },
  { nombre: "Perdido",     orden: 5, probabilidad: 0,   esInicial: false, esGanado: false, esPerdido: true,  color: "#fb7185" },
];

// Mismo criterio que src/shared/inicializacion/pipeline-default.ts, pero inline
// (evita depender del alias "@/" al ejecutar este script standalone con tsx).
async function crearPipelineDefault(instanciaId: string) {
  const existente = await prisma.pipeline.findFirst({ where: { instanciaId, esDefault: true } });
  if (existente) return existente;

  return prisma.pipeline.create({
    data: { nombre: "Pipeline de ventas", esDefault: true, activo: true, instanciaId, stages: { create: STAGES_DEFAULT } },
    include: { stages: true },
  });
}

const EMPRESAS_EJEMPLO = [
  { nombre: "Acme Corp", industria: "Tecnología", email: "contacto@acme-demo.com" },
  { nombre: "Norte Distribuciones", industria: "Logística", email: "ventas@norte-demo.com" },
];

const CONTACTOS_EJEMPLO = [
  { nombre: "Lucía", apellido: "Fernández", email: "lucia.fernandez@demo.com", telefonoPrincipal: "+507 6000-0001" },
  { nombre: "Marco", apellido: "Rivas", email: "marco.rivas@demo.com", telefonoPrincipal: "+507 6000-0002" },
  { nombre: "Elena", apellido: "Torres", email: "elena.torres@demo.com", telefonoPrincipal: "+507 6000-0003" },
];

const PRODUCTOS_EJEMPLO = [
  { nombre: "Plan Básico", precio: 49.9, categoria: "Software" },
  { nombre: "Plan Pro", precio: 149.9, categoria: "Software" },
  { nombre: "Soporte Premium", precio: 299, categoria: "Servicios" },
];

// Datos mínimos para que los listados (productos, contactos, empresas, oportunidades)
// no aparezcan vacíos en los tests E2E. Idempotente: solo crea si la instancia no tiene nada.
async function sembrarDatosEjemplo(instanciaId: string, usuarioId: string) {
  const stageInicial = (await crearPipelineDefault(instanciaId)).stages?.find((s) => s.esInicial) ?? null;

  const empresasExistentes = await prisma.empresa.count({ where: { instanciaId } });
  const empresas = empresasExistentes > 0
    ? await prisma.empresa.findMany({ where: { instanciaId } })
    : await Promise.all(
        EMPRESAS_EJEMPLO.map((e) => prisma.empresa.create({ data: { ...e, instanciaId, usuarioId } })),
      );
  if (empresasExistentes === 0) console.log(`✓ ${empresas.length} empresas de ejemplo`);

  const contactosExistentes = await prisma.contacto.count({ where: { instanciaId } });
  const contactos = contactosExistentes > 0
    ? await prisma.contacto.findMany({ where: { instanciaId } })
    : await Promise.all(
        CONTACTOS_EJEMPLO.map((c, i) =>
          prisma.contacto.create({
            data: { ...c, instanciaId, usuarioId, estado: "ACTIVO", empresaId: empresas[i % empresas.length]?.id ?? null },
          }),
        ),
      );
  if (contactosExistentes === 0) console.log(`✓ ${contactos.length} contactos de ejemplo`);

  const productosExistentes = await prisma.producto.count({ where: { instanciaId } });
  if (productosExistentes === 0) {
    await Promise.all(
      PRODUCTOS_EJEMPLO.map((p) => prisma.producto.create({ data: { ...p, instanciaId } })),
    );
    console.log(`✓ ${PRODUCTOS_EJEMPLO.length} productos de ejemplo`);
  }

  const oportunidadesExistentes = await prisma.oportunidad.count({ where: { instanciaId } });
  if (oportunidadesExistentes === 0 && contactos.length > 0) {
    const pipeline = await prisma.pipeline.findFirst({ where: { instanciaId, esDefault: true } });
    await Promise.all(
      contactos.map((c, i) =>
        prisma.oportunidad.create({
          data: {
            titulo: `Oportunidad de prueba ${i + 1}`,
            valor: 1000 * (i + 1),
            instanciaId,
            usuarioId,
            empresaId: c.empresaId,
            pipelineId: pipeline?.id ?? null,
            stageId: stageInicial?.id ?? null,
            contactos: { create: { contactoId: c.id, principal: true } },
          },
        }),
      ),
    );
    console.log(`✓ ${contactos.length} oportunidades de ejemplo`);
  }
}

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

  let usuarioOwnerId: string | null = null;

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

    if (rol === "OWNER") usuarioOwnerId = usuario.id;
    console.log(`✓ ${rol.padEnd(17)} ${email}`);
  }

  if (usuarioOwnerId) {
    await sembrarDatosEjemplo(instancia.id, usuarioOwnerId);
  } else {
    console.warn("⚠ No se encontró el usuario OWNER — se omite el seed de datos de ejemplo.");
  }

  console.log("\nListo. Los 7 usuarios de prueba ya pueden iniciar sesión en /login.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
