import { PrismaPg } from "@prisma/adapter-pg";
// Relative imports so this module works both in Next.js and in the standalone worker (tsx)
import { PrismaClient } from "../../../generated/prisma/client";
import { validarPedidoParaEtapa } from "../../../sales/flujo-venta/reglas/motor";
import { moverOportunidadAEtapa } from "../mover-stage";
import type {
  ConfigCrearTarea,
  ConfigCrearNota,
  ConfigWebhook,
  ConfigAsignarUsuario,
  ConfigAsignarEtiqueta,
  ConfigModificarCampo,
  ConfigCambiarEtapa,
  ConfigCerrarOportunidad,
} from "./types";

// ── Prisma singleton (safe for both Next.js HMR and long-running worker) ────

function crearCliente() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const g = globalThis as unknown as { _ejecutorPrisma?: PrismaClient };
const prisma = g._ejecutorPrisma ?? crearCliente();
if (process.env.NODE_ENV !== "production") g._ejecutorPrisma = prisma;

// ── Helpers compartidos ──────────────────────────────────────────────────────

async function cerrarConversacionesDeOportunidad(oportunidadId: string) {
  const links = await prisma.oportunidadConversacion.findMany({
    where: { oportunidadId },
    select: { conversacionId: true },
  });
  const ids = links.map((l) => l.conversacionId);
  if (ids.length === 0) return;
  await prisma.conversacion.updateMany({
    where: { id: { in: ids }, estado: { not: "CERRADA" } },
    data: { estado: "CERRADA" },
  });
}

// ── Reintentos ───────────────────────────────────────────────────────────────

const MAX_INTENTOS = 3;
const ESPERA_REINTENTO_MS = [60_000, 5 * 60_000];
// Más que el timeout de un webhook (10 s) con holgura: si un job sigue en
// PROCESANDO pasado este plazo, el worker que lo tomó se cayó.
const DURACION_BLOQUEO_MS = 5 * 60_000;
const LOTE = 25;

// Error de negocio: reintentar no lo arregla (campo no permitido, campos
// requeridos, validación del pedido, HTTP 4xx). Todo lo demás (red, timeout,
// HTTP 5xx/429, base de datos) se considera transitorio.
class ErrorDefinitivo extends Error {}

function errorHttp(status: number): Error {
  const mensaje = `HTTP ${status}`;
  return status >= 500 || status === 429 ? new Error(mensaje) : new ErrorDefinitivo(mensaje);
}

async function registrarFallo(job: { id: string; intentos: number }, err: unknown): Promise<{ exito: false }> {
  const mensaje = err instanceof Error ? err.message : "Error desconocido";
  const reintentar = !(err instanceof ErrorDefinitivo) && job.intentos < MAX_INTENTOS;
  await prisma.disparadorJob.update({
    where: { id: job.id },
    data: reintentar
      ? {
          estado: "PENDIENTE",
          ejecutarEn: new Date(Date.now() + ESPERA_REINTENTO_MS[Math.min(job.intentos - 1, ESPERA_REINTENTO_MS.length - 1)]),
          bloqueadoHasta: null,
          error: `Intento ${job.intentos}/${MAX_INTENTOS} falló: ${mensaje}`,
        }
      : { estado: "FALLIDO", procesadoEn: new Date(), bloqueadoHasta: null, error: mensaje },
  });
  return { exito: false };
}

async function registrarExito(jobId: string): Promise<{ exito: true }> {
  await prisma.disparadorJob.update({
    where: { id: jobId },
    data: { estado: "COMPLETADO", procesadoEn: new Date(), bloqueadoHasta: null, error: null, resultado: { ok: true } },
  });
  return { exito: true };
}

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
      if (!res.ok) throw errorHttp(res.status);
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
        if (!CAMPOS_PERMITIDOS.includes(cfg.clave)) throw new ErrorDefinitivo(`Campo no permitido: ${cfg.clave}`);
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
      // Mismo servicio que el Kanban (D7): historial, campos requeridos,
      // disparadores de la etapa destino y anti-ciclos entre disparadores.
      const cfg = config as unknown as ConfigCambiarEtapa;
      const movimiento = await moverOportunidadAEtapa({
        oportunidadId,
        stageId: cfg.stageId,
        pipelineId: cfg.pipelineId,
        ...(instanciaId && { instanciaId }),
        origen: { tipo: "DISPARADOR" },
        motivo: `Disparador "${job.disparador.nombre}"`,
      });
      if (!movimiento.exito) throw new ErrorDefinitivo(movimiento.error);
    }

    return await registrarExito(job.id);
  } catch (err) {
    return registrarFallo(job, err);
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
      if (!res.ok) throw errorHttp(res.status);
    } else if (tipo === "MODIFICAR_CAMPO") {
      const cfg = config as unknown as ConfigModificarCampo;
      if (cfg.modo === "campo_directo") {
        const CAMPOS_PERMITIDOS = ["notas", "moneda"];
        if (!CAMPOS_PERMITIDOS.includes(cfg.clave)) throw new ErrorDefinitivo(`Campo no permitido: ${cfg.clave}`);
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
        // Reglas de validación: una automatización nunca debe poder saltarse
        // un requisito obligatorio que un usuario tampoco podría saltarse
        // desde la pantalla de detalle — mismo servicio central que usa
        // validarTransicion (src/sales/flujo-venta/motor.ts). Si no se
        // cumple, el job queda FALLIDO (con el mensaje de la regla) y el
        // pedido NO se mueve.
        if (instanciaId) {
          const resultado = await validarPedidoParaEtapa(prisma, pedidoId, etapaDestinoId, instanciaId);
          if (!resultado.esValido) {
            if (resultado.reglaFallida) {
              await prisma.eventoLog.create({
                data: {
                  tipo: "REGLA_VALIDACION_RECHAZO",
                  payload: { pedidoId, etapaDestinoId, origen: "AUTOMATICO", disparadorId: job.disparadorId },
                  entidadTipo: "FlujoVentaRegla",
                  entidadId: resultado.reglaFallida.reglaId,
                  instanciaId,
                },
              });
            }
            const motivo = resultado.reglaFallida?.mensajeFallo?.trim()
              || `Requisito no cumplido: "${resultado.reglaFallida?.nombre ?? "regla de validación"}"`;
            throw new ErrorDefinitivo(motivo);
          }
        }
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
    } else if (tipo === "CERRAR_OPORTUNIDAD") {
      // Mueve la oportunidad relacionada al pedido a la etapa Ganada o
      // Perdida — la etapa concreta se resuelve en cada ejecución (nunca se
      // guarda un stageId fijo), así sigue funcionando aunque el pipeline
      // de esa oportunidad cambie de forma más adelante.
      const cfg = config as unknown as ConfigCerrarOportunidad;
      const oportunidadId = pedido?.oportunidadId;
      if (oportunidadId) {
        const oportunidad = await prisma.oportunidad.findUnique({
          where: { id: oportunidadId },
          select: { pipelineId: true, stageId: true, etapa: true },
        });
        if (oportunidad) {
          const ahora = new Date();
          if (oportunidad.pipelineId) {
            const stageDestino = await prisma.pipelineStage.findFirst({
              where: {
                pipelineId: oportunidad.pipelineId,
                activo: true,
                ...(cfg.resultado === "GANADA" ? { esGanado: true } : { esPerdido: true }),
              },
            });
            // Anti-loop: no mover si ya está en la etapa destino
            if (stageDestino && oportunidad.stageId !== stageDestino.id) {
              // Mismo servicio que el Kanban (D7). Sin validar campos
              // requeridos: este cierre automático nunca los exigió y un
              // pedido entregado no debe quedar con la oportunidad abierta
              // por un campo vacío.
              const movimiento = await moverOportunidadAEtapa({
                oportunidadId,
                stageId: stageDestino.id,
                pipelineId: oportunidad.pipelineId,
                ...(instanciaId && { instanciaId }),
                origen: { tipo: "DISPARADOR" },
                motivo: `Pedido ${cfg.resultado === "GANADA" ? "ganado" : "perdido"} — disparador "${job.disparador.nombre}"`,
                validarCamposRequeridos: false,
              });
              if (!movimiento.exito) throw new ErrorDefinitivo(movimiento.error);
            }
          } else {
            // Oportunidad sin pipeline dinámico: usa el sistema legado de etapa fija
            const etapaDestino = cfg.resultado === "GANADA" ? "GANADO" : "PERDIDO";
            if (oportunidad.etapa !== etapaDestino) {
              await prisma.oportunidad.update({
                where: { id: oportunidadId },
                data: {
                  etapa: etapaDestino,
                  probabilidad: etapaDestino === "GANADO" ? 100 : 0,
                  ...(etapaDestino === "GANADO" ? { fechaGanada: ahora } : { fechaPerdida: ahora }),
                },
              });
              await cerrarConversacionesDeOportunidad(oportunidadId);
            }
          }
        }
      }
      // Pedido sin oportunidad relacionada: no-op silencioso (no todos los pedidos vienen de una)
    }
    // ASIGNAR_USUARIO y ASIGNAR_ETIQUETA: skip silencioso para pedidos

    return await registrarExito(job.id);
  } catch (err) {
    return registrarFallo(job, err);
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
  return registrarFallo(job, new ErrorDefinitivo("Job sin entidad asociada"));
}

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Jobs que quedaron en PROCESANDO porque el worker se cayó a mitad. Los que
 * tienen bloqueo vencido vuelven a la cola (o fallan si agotaron intentos).
 * Los que no tienen bloqueo son anteriores a este mecanismo: se marcan
 * FALLIDO sin reintentar, porque podrían ser de hace mucho (p.ej. un webhook
 * de hace meses no debe dispararse ahora).
 */
export async function recuperarJobsInterrumpidos(ahora: Date = new Date()): Promise<number> {
  const mensaje = "Interrumpido: el worker se detuvo mientras se ejecutaba";
  const [reencolados, agotados, legados] = await Promise.all([
    prisma.disparadorJob.updateMany({
      where: { estado: "PROCESANDO", bloqueadoHasta: { lt: ahora }, intentos: { lt: MAX_INTENTOS } },
      data: { estado: "PENDIENTE", ejecutarEn: ahora, bloqueadoHasta: null, error: mensaje },
    }),
    prisma.disparadorJob.updateMany({
      where: { estado: "PROCESANDO", bloqueadoHasta: { lt: ahora }, intentos: { gte: MAX_INTENTOS } },
      data: { estado: "FALLIDO", procesadoEn: ahora, bloqueadoHasta: null, error: mensaje },
    }),
    prisma.disparadorJob.updateMany({
      where: {
        estado: "PROCESANDO",
        bloqueadoHasta: null,
        ejecutarEn: { lt: new Date(ahora.getTime() - 2 * DURACION_BLOQUEO_MS) },
      },
      data: { estado: "FALLIDO", procesadoEn: ahora, error: `${mensaje} (antes de habilitar reintentos)` },
    }),
  ]);
  return reencolados.count + agotados.count + legados.count;
}

/**
 * Toma un lote de jobs vencidos de forma atómica: FOR UPDATE SKIP LOCKED hace
 * que dos workers en paralelo nunca tomen el mismo job.
 */
async function reclamarJobs(ahora: Date): Promise<string[]> {
  const bloqueadoHasta = new Date(ahora.getTime() + DURACION_BLOQUEO_MS);
  const filas = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "DisparadorJob"
    SET "estado" = 'PROCESANDO', "intentos" = "intentos" + 1, "bloqueadoHasta" = ${bloqueadoHasta}
    WHERE "id" IN (
      SELECT "id" FROM "DisparadorJob"
      WHERE "estado" = 'PENDIENTE' AND "ejecutarEn" <= ${ahora}
      ORDER BY "ejecutarEn" ASC
      LIMIT ${LOTE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"`;
  return filas.map((f) => f.id);
}

export async function ejecutarJobsPendientes(): Promise<{
  procesados: number;
  completados: number;
  fallidos: number;
}> {
  const ahora = new Date();
  await recuperarJobsInterrumpidos(ahora);

  const ids = await reclamarJobs(ahora);
  if (ids.length === 0) return { procesados: 0, completados: 0, fallidos: 0 };

  const jobs = await prisma.disparadorJob.findMany({
    where: { id: { in: ids } },
    orderBy: { ejecutarEn: "asc" },
    include: { disparador: true },
  });

  const resultados = await Promise.allSettled(jobs.map(ejecutarJob));
  const completados = resultados.filter(
    (r) => r.status === "fulfilled" && r.value.exito
  ).length;

  return { procesados: jobs.length, completados, fallidos: jobs.length - completados };
}
