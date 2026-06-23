/**
 * Proceso worker que ejecuta las operaciones de datos contra Prisma.
 *
 * Corre como proceso hijo lanzado con `tsx` (no como parte del proceso de
 * Playwright). El cliente generado de Prisma usa `import.meta.url` (ESM
 * puro); Playwright transpila los .spec.ts a CommonJS vía babel y eso rompe
 * con "Cannot use 'import.meta' outside a module" sin importar si el import
 * es estático o dinámico. Aislarlo en un proceso aparte ejecutado con `tsx`
 * (que sí soporta ESM nativo) evita el problema por completo.
 *
 * Protocolo: una línea JSON por request en stdin (`{ id, op, args }`),
 * una línea JSON por response en stdout (`{ id, ok, result }` o
 * `{ id, ok: false, error }`). Ver tests/helpers/db.ts para el lado cliente.
 */
import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.test" });

import * as readline from "node:readline";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type TipoActividad } from "../../src/generated/prisma/client";
import { generarSlug } from "../../src/shared/lib/slug";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const NOMBRE_INSTANCIA = "Instancia de Pruebas";
let instanciaCacheada: { id: string } | null = null;

async function obtenerInstanciaPruebas() {
  if (instanciaCacheada) return instanciaCacheada;

  const slug = generarSlug(NOMBRE_INSTANCIA);
  const instancia = await prisma.instancia.findUnique({ where: { slug } });
  if (!instancia) {
    throw new Error(
      `No existe la "${NOMBRE_INSTANCIA}". Corre "npm run db:seed:test" antes de la suite E2E.`,
    );
  }

  instanciaCacheada = instancia;
  return instancia;
}

async function obtenerUsuarioOwner(instanciaId: string) {
  const usuarioInstancia = await prisma.usuarioInstancia.findFirst({
    where: { instanciaId, rol: "OWNER" },
    include: { usuario: true },
  });
  if (!usuarioInstancia) {
    throw new Error(`No existe un usuario OWNER en la instancia ${instanciaId}.`);
  }
  return usuarioInstancia.usuario;
}

async function crearActividad(overrides: {
  instanciaId: string;
  usuarioId: string;
  titulo?: string;
  tipo?: TipoActividad;
  completada?: boolean;
  contactoId?: string | null;
  oportunidadId?: string | null;
  fecha?: string;
}) {
  return prisma.actividad.create({
    data: {
      titulo: overrides.titulo ?? `Actividad-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tipo: overrides.tipo ?? "TAREA",
      completada: overrides.completada ?? false,
      fecha: overrides.fecha ? new Date(overrides.fecha) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      contactoId: overrides.contactoId ?? null,
      oportunidadId: overrides.oportunidadId ?? null,
      instanciaId: overrides.instanciaId,
      usuarioId: overrides.usuarioId,
    },
  });
}

async function crearContacto(overrides: { instanciaId: string; usuarioId: string; empresaId?: string | null }) {
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return prisma.contacto.create({
    data: {
      nombre: "Contacto",
      apellido: `Prueba-${sufijo}`,
      email: `contacto-${sufijo}@demo.com`,
      estado: "ACTIVO",
      empresaId: overrides.empresaId ?? null,
      instanciaId: overrides.instanciaId,
      usuarioId: overrides.usuarioId,
    },
  });
}

async function crearEmpresa(overrides: { instanciaId: string; usuarioId: string }) {
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return prisma.empresa.create({
    data: {
      nombre: `Empresa-Prueba-${sufijo}`,
      industria: "Tecnología",
      email: `empresa-${sufijo}@demo.com`,
      instanciaId: overrides.instanciaId,
      usuarioId: overrides.usuarioId,
    },
  });
}

async function crearOportunidad(overrides: {
  instanciaId: string;
  usuarioId: string;
  titulo?: string;
  empresaId?: string | null;
  pipelineId?: string | null;
  stageId?: string | null;
}) {
  return prisma.oportunidad.create({
    data: {
      titulo: overrides.titulo ?? `Oportunidad-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      valor: 1000,
      instanciaId: overrides.instanciaId,
      usuarioId: overrides.usuarioId,
      empresaId: overrides.empresaId ?? null,
      pipelineId: overrides.pipelineId ?? null,
      stageId: overrides.stageId ?? null,
    },
  });
}

async function asegurarAlMenosUnContacto(instanciaId: string, usuarioId: string) {
  const existente = await prisma.contacto.findFirst({ where: { instanciaId } });
  if (existente) return existente;
  return crearContacto({ instanciaId, usuarioId });
}

async function asegurarAlMenosUnaOportunidad(instanciaId: string, usuarioId: string) {
  const existente = await prisma.oportunidad.findFirst({ where: { instanciaId } });
  if (existente) return existente;
  return crearOportunidad({ instanciaId, usuarioId });
}

const STAGES_PIPELINE_B = [
  { nombre: "Inicial", orden: 0, probabilidad: 10, esInicial: true, esGanado: false, esPerdido: false, color: "#818cf8" },
  { nombre: "Avanzada", orden: 1, probabilidad: 60, esInicial: false, esGanado: false, esPerdido: false, color: "#fbbf24" },
  { nombre: "Cerrada", orden: 2, probabilidad: 100, esInicial: false, esGanado: true, esPerdido: false, color: "#4ade80" },
];

// Idempotente: garantiza que la instancia tenga al menos 2 pipelines, para que
// los tests que alternan entre pipelines (ej. O-06) no dependan de test.skip.
async function asegurarSegundoPipeline(instanciaId: string) {
  const cantidad = await prisma.pipeline.count({ where: { instanciaId } });
  if (cantidad >= 2) return { ok: true };

  await prisma.pipeline.create({
    data: {
      nombre: "Pipeline de prueba B",
      esDefault: false,
      activo: true,
      instanciaId,
      stages: { create: STAGES_PIPELINE_B },
    },
  });
  return { ok: true };
}

async function vaciarActividades(instanciaId: string) {
  await prisma.actividad.deleteMany({ where: { instanciaId } });
  return { ok: true };
}

// Respeta el mismo orden de FKs que prisma/limpiar-datos-prueba.ts.
async function vaciarOportunidades(instanciaId: string) {
  await prisma.disparadorJob.deleteMany({ where: { oportunidad: { instanciaId } } });
  await prisma.oportunidadConversacion.deleteMany({ where: { oportunidad: { instanciaId } } });
  await prisma.oportunidadTag.deleteMany({ where: { oportunidad: { instanciaId } } });
  await prisma.oportunidadProducto.deleteMany({ where: { oportunidad: { instanciaId } } });
  await prisma.oportunidadContacto.deleteMany({ where: { oportunidad: { instanciaId } } });
  await prisma.actividad.deleteMany({ where: { oportunidadId: { not: null }, instanciaId } });
  await prisma.oportunidad.deleteMany({ where: { instanciaId } });
  return { ok: true };
}

const OPERACIONES: Record<string, (...args: any[]) => Promise<unknown>> = {
  obtenerInstanciaPruebas,
  obtenerUsuarioOwner,
  crearActividad,
  crearContacto,
  crearEmpresa,
  crearOportunidad,
  asegurarAlMenosUnContacto,
  asegurarAlMenosUnaOportunidad,
  asegurarSegundoPipeline,
  vaciarActividades,
  vaciarOportunidades,
};

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  if (!line.trim()) return;

  let mensaje: { id: number; op: string; args: unknown[] };
  try {
    mensaje = JSON.parse(line);
  } catch {
    return;
  }

  const { id, op, args } = mensaje;
  try {
    const fn = OPERACIONES[op];
    if (!fn) throw new Error(`Operación desconocida: ${op}`);
    const result = await fn(...args);
    process.stdout.write(`${JSON.stringify({ id, ok: true, result })}\n`);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ id, ok: false, error: error instanceof Error ? error.message : String(error) })}\n`,
    );
  }
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
