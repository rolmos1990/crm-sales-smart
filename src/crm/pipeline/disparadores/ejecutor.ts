import { PrismaPg } from "@prisma/adapter-pg";
// Relative imports so this module works both in Next.js and in the standalone worker (tsx)
import { PrismaClient } from "../../../generated/prisma/client";
import type {
  ConfigCrearTarea,
  ConfigCrearNota,
  ConfigWebhook,
  ConfigAsignarUsuario,
  ConfigAsignarEtiqueta,
  ConfigModificarCampo,
  ConfigCambiarEtapa,
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

// ── Ejecución para Oportunidades (CRM) ──────────────────────────────────────

async function ejecutarJobOportunidad(
  job: JobConDisparador,
  oportunidadId: string,
): Promise<{ exito: boolean }> {
  try {
    const payload = job.payload as Record<string, unknown>;
    const instanciaId = (payload.instanciaId as string | undefined) ?? null;
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
          oportunidadId,
          instanciaId,
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
          oportunidadId,
          instanciaId,
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
            ? JSON.stringify({ ...payload, oportunidadId })
            : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } else if (tipo === "ASIGNAR_USUARIO") {
      const cfg = config as unknown as ConfigAsignarUsuario;
      await prisma.oportunidad.update({
        where: { id: oportunidadId },
        data: { usuarioId: cfg.usuarioId },
      });
    } else if (tipo === "ASIGNAR_ETIQUETA") {
      const cfg = config as unknown as ConfigAsignarEtiqueta;
      await prisma.oportunidadTag.upsert({
        where: { oportunidadId_tagId: { oportunidadId, tagId: cfg.tagId } },
        create: { oportunidadId, tagId: cfg.tagId },
        update: {},
      });
    } else if (tipo === "MODIFICAR_CAMPO") {
      const cfg = config as unknown as ConfigModificarCampo;
      if (cfg.modo === "campo_directo") {
        const CAMPOS_PERMITIDOS = ["titulo", "notas", "moneda", "etapa", "valor", "probabilidad"];
        if (!CAMPOS_PERMITIDOS.includes(cfg.clave)) throw new Error(`Campo no permitido: ${cfg.clave}`);
        const valorConvertido: unknown =
          cfg.clave === "valor" || cfg.clave === "probabilidad"
            ? parseFloat(cfg.valor) || 0
            : cfg.valor;
        await prisma.oportunidad.update({
          where: { id: oportunidadId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { [cfg.clave]: valorConvertido } as any,
        });
      } else {
        const actual = await prisma.oportunidad.findUnique({
          where: { id: oportunidadId },
          select: { metadata: true },
        });
        const metadataActual = (actual?.metadata ?? {}) as Record<string, unknown>;
        await prisma.oportunidad.update({
          where: { id: oportunidadId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { metadata: { ...metadataActual, [cfg.clave]: cfg.valor } as any },
        });
      }
    } else if (tipo === "CAMBIAR_ETAPA") {
      const cfg = config as unknown as ConfigCambiarEtapa;
      await prisma.oportunidad.update({
        where: { id: oportunidadId },
        data: {
          stageId: cfg.stageId,
          pipelineId: cfg.pipelineId,
        },
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

// ── Ejecución para Pedidos (Flujo de Venta) ──────────────────────────────────

async function ejecutarJobPedido(
  job: JobConDisparador,
  pedidoId: string,
): Promise<{ exito: boolean }> {
  try {
    const payload = job.payload as Record<string, unknown>;
    const instanciaId = (payload.instanciaId as string | undefined) ?? null;
    const tipo = job.disparador.tipo;
    const config = job.disparador.config;

    // Para CREAR_TAREA y CREAR_NOTA vinculamos a la oportunidad del pedido si existe
    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { oportunidadId: true, flujoVentaEtapaId: true, metadata: true },
    });

    if (tipo === "CREAR_TAREA") {
      const cfg = config as unknown as ConfigCrearTarea;
      await prisma.actividad.create({
        data: {
          tipo: "TAREA",
          titulo: cfg.titulo,
          descripcion: cfg.descripcion ?? null,
          fecha: new Date(),
          oportunidadId: pedido?.oportunidadId ?? null,
          instanciaId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { disparadorId: job.disparadorId, pedidoId, payload } as any,
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
          oportunidadId: pedido?.oportunidadId ?? null,
          instanciaId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { disparadorId: job.disparadorId, pedidoId, payload } as any,
        },
      });
    } else if (tipo === "WEBHOOK") {
      const cfg = config as unknown as ConfigWebhook;
      const res = await fetch(cfg.url, {
        method: cfg.method ?? "POST",
        headers: { "Content-Type": "application/json", ...(cfg.headers ?? {}) },
        body:
          cfg.method !== "GET"
            ? JSON.stringify({ ...payload, pedidoId })
            : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } else if (tipo === "MODIFICAR_CAMPO") {
      const cfg = config as unknown as ConfigModificarCampo;
      if (cfg.modo === "campo_directo") {
        const CAMPOS_PERMITIDOS = ["notas", "moneda"];
        if (!CAMPOS_PERMITIDOS.includes(cfg.clave)) throw new Error(`Campo no permitido: ${cfg.clave}`);
        await prisma.pedido.update({
          where: { id: pedidoId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { [cfg.clave]: cfg.valor } as any,
        });
      } else {
        const metadataActual = ((pedido?.metadata ?? {}) as Record<string, unknown>);
        await prisma.pedido.update({
          where: { id: pedidoId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { metadata: { ...metadataActual, [cfg.clave]: cfg.valor } as any },
        });
      }
    } else if (tipo === "CAMBIAR_ETAPA") {
      // config.stageId contiene el flujoVentaEtapaId destino
      const cfg = config as unknown as ConfigCambiarEtapa;
      const etapaDestinoId = cfg.stageId;
      // Anti-loop: no mover si ya está en la etapa destino
      if (pedido?.flujoVentaEtapaId !== etapaDestinoId) {
        await prisma.pedido.update({
          where: { id: pedidoId },
          data: { flujoVentaEtapaId: etapaDestinoId },
        });
        const etapa = await prisma.flujoVentaEtapa.findUnique({
          where: { id: etapaDestinoId },
          select: { nombre: true, flujoVentaId: true },
        });
        if (etapa) {
          await prisma.pedidoHistorialEtapa.create({
            data: {
              pedidoId,
              etapaId: etapaDestinoId,
              etapaNombre: etapa.nombre,
              tipo: "AUTOMATICO",
              usuarioId: null,
            },
          });
        }
      }
    }
    // ASIGNAR_USUARIO y ASIGNAR_ETIQUETA: skip silencioso para pedidos

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

// ── Dispatcher ────────────────────────────────────────────────────────────────

async function ejecutarJob(job: JobConDisparador): Promise<{ exito: boolean }> {
  if (job.oportunidadId) {
    return ejecutarJobOportunidad(job, job.oportunidadId);
  }
  if (job.pedidoId) {
    return ejecutarJobPedido(job, job.pedidoId);
  }
  // Job sin entidad — marcar como fallido
  await prisma.disparadorJob.update({
    where: { id: job.id },
    data: { estado: "FALLIDO", procesadoEn: new Date(), error: "Job sin entidad asociada" },
  });
  return { exito: false };
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
