import { PrismaPg } from "@prisma/adapter-pg";
// Relative imports so this module works both in Next.js and in the standalone worker (tsx)
import { PrismaClient } from "../../../generated/prisma/client";
import type {
  ConfigCrearTarea,
  ConfigCrearNota,
  ConfigWebhook,
  ConfigAsignarUsuario,
} from "./types";

// ── Prisma singleton (safe for both Next.js HMR and long-running worker) ────

function crearCliente() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const g = globalThis as unknown as { _ejecutorPrisma?: PrismaClient };
const prisma = g._ejecutorPrisma ?? crearCliente();
if (process.env.NODE_ENV !== "production") g._ejecutorPrisma = prisma;

// ── Tipos ────────────────────────────────────────────────────────────────────

type JobConDisparador = Awaited<
  ReturnType<typeof prisma.disparadorJob.findMany<{ include: { disparador: true } }>>
>[number];

// ── Ejecución de un job individual ──────────────────────────────────────────

async function ejecutarJob(job: JobConDisparador): Promise<{ exito: boolean }> {
  try {
    const payload = job.payload as Record<string, unknown>;
    const tipo = job.disparador.tipo;
    const config = job.disparador.config;

    if (tipo === "CREAR_TAREA") {
      const cfg = config as unknown as ConfigCrearTarea;
      await prisma.actividad.create({
        data: {
          tipo: "TAREA",
          titulo: cfg.titulo,
          descripcion: cfg.descripcion ?? null,
          fecha: new Date(),
          oportunidadId: job.oportunidadId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { disparadorId: job.disparadorId, payload } as any,
        },
      });
    } else if (tipo === "CREAR_NOTA") {
      const cfg = config as unknown as ConfigCrearNota;
      await prisma.actividad.create({
        data: {
          tipo: "NOTA",
          titulo: "Nota automática",
          descripcion: cfg.contenido,
          fecha: new Date(),
          oportunidadId: job.oportunidadId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { disparadorId: job.disparadorId, payload } as any,
        },
      });
    } else if (tipo === "WEBHOOK") {
      const cfg = config as unknown as ConfigWebhook;
      const res = await fetch(cfg.url, {
        method: cfg.method ?? "POST",
        headers: { "Content-Type": "application/json", ...(cfg.headers ?? {}) },
        body:
          cfg.method !== "GET"
            ? JSON.stringify({ ...payload, oportunidadId: job.oportunidadId })
            : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } else if (tipo === "ASIGNAR_USUARIO") {
      const cfg = config as unknown as ConfigAsignarUsuario;
      await prisma.oportunidad.update({
        where: { id: job.oportunidadId },
        data: { usuarioId: cfg.usuarioId },
      });
    }

    await prisma.disparadorJob.update({
      where: { id: job.id },
      data: { estado: "COMPLETADO", procesadoEn: new Date(), resultado: { ok: true } },
    });
    return { exito: true };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido";
    await prisma.disparadorJob.update({
      where: { id: job.id },
      data: { estado: "FALLIDO", procesadoEn: new Date(), error: mensaje },
    });
    return { exito: false };
  }
}

// ── API pública ──────────────────────────────────────────────────────────────

export async function ejecutarJobsPendientes(): Promise<{
  procesados: number;
  completados: number;
  fallidos: number;
}> {
  const jobs = await prisma.disparadorJob.findMany({
    where: { estado: "PENDIENTE", ejecutarEn: { lte: new Date() } },
    orderBy: { ejecutarEn: "asc" },
    take: 25,
    include: { disparador: true },
  });

  if (jobs.length === 0) return { procesados: 0, completados: 0, fallidos: 0 };

  await prisma.disparadorJob.updateMany({
    where: { id: { in: jobs.map((j) => j.id) } },
    data: { estado: "PROCESANDO" },
  });

  const resultados = await Promise.allSettled(jobs.map(ejecutarJob));
  const completados = resultados.filter(
    (r) => r.status === "fulfilled" && r.value.exito
  ).length;

  return { procesados: jobs.length, completados, fallidos: jobs.length - completados };
}
