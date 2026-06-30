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

// Garantiza un pipeline con stages y al menos una oportunidad en su primera
// etapa, para que el tablero Kanban dinámico (/crm/pipeline) tenga contenido
// determinístico sin depender de qué pipeline quedó marcado esDefault.
async function asegurarOportunidadEnPipeline(instanciaId: string, usuarioId: string) {
  let pipeline = await prisma.pipeline.findFirst({
    where: { instanciaId, activo: true },
    include: { stages: { orderBy: { orden: "asc" } } },
  });

  if (!pipeline || pipeline.stages.length === 0) {
    pipeline = await prisma.pipeline.create({
      data: {
        nombre: "Pipeline de prueba",
        esDefault: true,
        activo: true,
        instanciaId,
        stages: {
          create: [
            { nombre: "Inicial", orden: 0, probabilidad: 10, esInicial: true, esGanado: false, esPerdido: false, color: "#818cf8" },
            { nombre: "Avanzada", orden: 1, probabilidad: 60, esInicial: false, esGanado: false, esPerdido: false, color: "#fbbf24" },
            { nombre: "Cerrada", orden: 2, probabilidad: 100, esInicial: false, esGanado: true, esPerdido: false, color: "#4ade80" },
          ],
        },
      },
      include: { stages: { orderBy: { orden: "asc" } } },
    });
  }

  const primeraEtapa = pipeline.stages.find((s) => !s.esGanado && !s.esPerdido) ?? pipeline.stages[0];

  const existente = await prisma.oportunidad.findFirst({
    where: { instanciaId, pipelineId: pipeline.id, stageId: primeraEtapa.id },
  });
  const oportunidad = existente ?? await crearOportunidad({
    instanciaId, usuarioId, pipelineId: pipeline.id, stageId: primeraEtapa.id,
  });

  return { pipelineId: pipeline.id, stageId: primeraEtapa.id, oportunidad };
}

// Garantiza el FlujoVenta de la instancia (auto-creado sin etapas la primera
// vez que se visita /sales/flujo-venta) con al menos 2 etapas — una inicial y
// una final — para que las pruebas de transición (FV-07/08) tengan un flujo
// real y determinístico sin depender de qué quedó configurado en corridas
// anteriores.
async function asegurarFlujoConEtapas(instanciaId: string) {
  let flujo = await prisma.flujoVenta.findFirst({
    where: { instanciaId },
    include: { etapas: { orderBy: { orden: "asc" } } },
  });

  if (!flujo) {
    flujo = await prisma.flujoVenta.create({
      data: { nombre: "Flujo de venta", esDefault: true, instanciaId },
      include: { etapas: { orderBy: { orden: "asc" } } },
    });
  }

  if (flujo.etapas.length < 2) {
    await prisma.flujoVentaEtapa.deleteMany({ where: { flujoVentaId: flujo.id } });
    await prisma.flujoVentaEtapa.createMany({
      data: [
        { flujoVentaId: flujo.id, nombre: "Pendiente", orden: 0, esInicial: true, color: "#94a3b8" },
        { flujoVentaId: flujo.id, nombre: "Completado", orden: 1, esFinal: true, color: "#4ade80" },
      ],
    });
    flujo = await prisma.flujoVenta.findFirst({
      where: { id: flujo.id },
      include: { etapas: { orderBy: { orden: "asc" } } },
    }) as NonNullable<typeof flujo>;
  }

  return { flujoVentaId: flujo.id, etapas: flujo.etapas.map((e) => ({ id: e.id, nombre: e.nombre, esInicial: e.esInicial, esFinal: e.esFinal })) };
}

// Crea (o reutiliza) una etapa esFinal y un pedido ya ubicado en ella, para
// probar de forma determinística que un pedido en etapa final no tiene
// transiciones disponibles (FV-08) — sin depender de "click hasta agotar"
// sobre el flujo compartido, que acumula etapas entre corridas de FV-02/04
// y vuelve frágil recorrer la cadena completa por UI.
async function crearPedidoEnEtapaFinal(instanciaId: string, usuarioId: string) {
  const flujo = await prisma.flujoVenta.findFirst({
    where: { instanciaId },
    include: { etapas: true },
  });
  if (!flujo) throw new Error("No existe flujo de venta para la instancia");

  let etapaFinal = flujo.etapas.find((e) => e.esFinal);
  if (!etapaFinal) {
    etapaFinal = await prisma.flujoVentaEtapa.create({
      data: { flujoVentaId: flujo.id, nombre: "Completado", orden: 999, esFinal: true, color: "#4ade80" },
    });
  }

  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const pedido = await prisma.pedido.create({
    data: {
      numero: `PED-TEST-${sufijo}`, estado: "PENDIENTE", instanciaId, usuarioId,
      flujoVentaId: flujo.id, flujoVentaEtapaId: etapaFinal.id,
    },
  });

  return { pedidoId: pedido.id, etapaNombre: etapaFinal.nombre };
}

// Crea (o reutiliza) una etapa con permiteEditarEntrega:true y un pedido ya
// ubicado en ella — la sección "Entrega y seguimiento" del pedido está
// bloqueada por defecto (requiere una etapa que explícitamente lo permita),
// así que sin esto los tests de transportistas en pedidos (TR-05/06/07)
// nunca llegan a ver el selector real.
async function crearPedidoConEntregaEditable(instanciaId: string, usuarioId: string) {
  const flujo = await prisma.flujoVenta.findFirst({
    where: { instanciaId },
    include: { etapas: true },
  });
  if (!flujo) throw new Error("No existe flujo de venta para la instancia");

  let etapa = flujo.etapas.find((e) => e.permiteEditarEntrega);
  if (!etapa) {
    etapa = await prisma.flujoVentaEtapa.create({
      data: { flujoVentaId: flujo.id, nombre: "En preparación", orden: 998, permiteEditarEntrega: true, color: "#fbbf24" },
    });
  }

  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const pedido = await prisma.pedido.create({
    data: {
      numero: `PED-TEST-${sufijo}`, estado: "PENDIENTE", instanciaId, usuarioId,
      flujoVentaId: flujo.id, flujoVentaEtapaId: etapa.id,
    },
  });

  return { pedidoId: pedido.id };
}

// Crea una etapa nueva (nombre único) con un pedido ya vinculado a ella, para
// probar de forma determinística que eliminarEtapa rechaza etapas con
// pedidos asociados (FV-06) — no depende de qué etapa haya quedado con
// pedidos por corridas anteriores.
async function crearEtapaConPedido(instanciaId: string, usuarioId: string) {
  const flujo = await prisma.flujoVenta.findFirst({ where: { instanciaId } });
  if (!flujo) throw new Error("No existe flujo de venta para la instancia");

  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const etapa = await prisma.flujoVentaEtapa.create({
    data: { flujoVentaId: flujo.id, nombre: `EtapaConPedido-${sufijo}`, orden: 999 },
  });

  const numero = `PED-TEST-${sufijo}`;
  const pedido = await prisma.pedido.create({
    data: {
      numero, estado: "PENDIENTE", instanciaId, usuarioId,
      flujoVentaId: flujo.id, flujoVentaEtapaId: etapa.id,
    },
  });

  return { etapaId: etapa.id, etapaNombre: etapa.nombre, pedidoId: pedido.id };
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
  asegurarOportunidadEnPipeline,
  asegurarSegundoPipeline,
  asegurarFlujoConEtapas,
  crearEtapaConPedido,
  crearPedidoEnEtapaFinal,
  crearPedidoConEntregaEditable,
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
