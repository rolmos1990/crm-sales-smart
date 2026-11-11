import { prisma } from "@/shared/db/prisma";
import {
  ESTADOS_ACTIVOS,
  aplicarInterrupcion,
  avanzarEjecucion,
  cancelarEjecucion,
  crearEjecucion,
} from "./motor";

// Cómo arrancan y continúan las ejecuciones: mensajes entrantes, entrada a
// una etapa y el ciclo periódico del worker (timers, recuperación y
// respaldo de eventos perdidos).

export async function workflowsHabilitados(instanciaId: string): Promise<boolean> {
  const c = await prisma.configuracionEmpresa.findUnique({ where: { instanciaId }, select: { workflowsHabilitado: true } });
  return c?.workflowsHabilitado === true;
}

// ── Mensaje entrante ────────────────────────────────────────────────────────

/**
 * Punto único de decisión para cada mensaje del cliente (lo llama
 * OrquestarIASuscriptor antes de su lógica). `atendido: true` significa que
 * la IA por etapa NO debe responder: un Workflow lo procesa, un humano
 * atiende, o la empresa tiene Workflows habilitados (D3: la IA solo actúa
 * dentro de un Workflow).
 */
export async function enrutarMensajeEntrante(p: {
  instanciaId: string;
  conversacionId: string;
  mensajeId: string;
  oportunidadId?: string | null;
}): Promise<{ atendido: boolean }> {
  if (!(await workflowsHabilitados(p.instanciaId))) return { atendido: false };

  const [conv, mensaje] = await Promise.all([
    prisma.conversacion.findFirst({
      where: { id: p.conversacionId, instanciaId: p.instanciaId },
      select: { modoAtencion: true, contactoId: true },
    }),
    prisma.mensajeConversacion.findUnique({ where: { id: p.mensajeId }, select: { contenido: true } }),
  ]);
  if (!conv) return { atendido: true };
  if (conv.modoAtencion === "HUMANO") return { atendido: true };

  const activas = await prisma.workflowEjecucion.findMany({
    where: { conversacionId: p.conversacionId, instanciaId: p.instanciaId, estado: { in: ESTADOS_ACTIVOS } },
    select: { id: true, estado: true, esperaTipo: true },
  });
  for (const ej of activas) {
    if (ej.estado === "ESPERANDO_RESPUESTA" || ej.estado === "IA_ACTIVA") {
      await avanzarEjecucion(ej.id, { tipo: "MENSAJE", mensajeId: p.mensajeId, texto: mensaje?.contenido ?? "" });
    } else if (ej.estado === "ESPERANDO_TIMER" && ej.esperaTipo === "TIMER") {
      await aplicarInterrupcion(ej.id, "CLIENTE_RESPONDE");
    }
  }
  if (activas.length > 0) return { atendido: true };

  // Sin ejecución en curso: ¿algún Workflow se inicia con "Mensaje recibido"?
  const asignacion = await prisma.workflowAsignacion.findFirst({
    where: { instanciaId: p.instanciaId, disparador: "MENSAJE_RECIBIDO", activo: true, workflow: { estado: "PUBLICADO" } },
    orderBy: { creadoEn: "asc" },
    select: { id: true, workflowId: true },
  });
  if (asignacion) {
    const r = await crearEjecucion({
      instanciaId: p.instanciaId,
      workflowId: asignacion.workflowId,
      disparador: "MENSAJE_RECIBIDO",
      claveIdempotencia: `mensaje:${p.mensajeId}`,
      conversacionId: p.conversacionId,
      contactoId: conv.contactoId,
      oportunidadId: p.oportunidadId ?? null,
    });
    if (r.ejecucionId && r.creada) await avanzarEjecucion(r.ejecucionId);
  }
  return { atendido: true };
}

// ── Entrada a una etapa ─────────────────────────────────────────────────────

/**
 * Procesa una fila de OportunidadHistorialEtapa (llega por el evento
 * OportunidadMovidaDeEtapa o por el barrido de respaldo). Idempotente: la
 * ejecución nueva usa la clave `etapa:<historialId>` y la fila se marca
 * procesada.
 */
export async function procesarMovimientoEtapa(historialId: string): Promise<void> {
  const h = await prisma.oportunidadHistorialEtapa.findUnique({
    where: { id: historialId },
    select: {
      id: true,
      instanciaId: true,
      oportunidadId: true,
      stageNuevoId: true,
      pipelineId: true,
      ejecucionWorkflowId: true,
      procesadoWorkflowEn: true,
    },
  });
  if (!h || h.procesadoWorkflowEn) return;

  if (await workflowsHabilitados(h.instanciaId)) {
    // D5: se cancela lo pendiente que nació en otra etapa.
    const deOtraEtapa = await prisma.workflowEjecucion.findMany({
      where: {
        oportunidadId: h.oportunidadId,
        stageId: { not: null },
        NOT: { stageId: h.stageNuevoId },
        estado: { in: [...ESTADOS_ACTIVOS, "TRANSFERIDA_HUMANO"] },
      },
      select: { id: true },
    });
    for (const ej of deOtraEtapa) await cancelarEjecucion(ej.id, "La oportunidad cambió de etapa");

    // Ejecuciones no ligadas a una etapa (p.ej. iniciadas por un mensaje):
    // sus Timers aplican su política.
    const etapa = await prisma.pipelineStage.findUnique({ where: { id: h.stageNuevoId }, select: { esGanado: true } });
    const conTimer = await prisma.workflowEjecucion.findMany({
      where: { oportunidadId: h.oportunidadId, stageId: null, estado: "ESPERANDO_TIMER", esperaTipo: "TIMER" },
      select: { id: true },
    });
    for (const ej of conTimer) {
      await aplicarInterrupcion(ej.id, etapa?.esGanado ? "OPORTUNIDAD_GANADA" : "CAMBIO_ETAPA");
    }

    const asignacion = await prisma.workflowAsignacion.findFirst({
      where: { stageId: h.stageNuevoId, instanciaId: h.instanciaId, disparador: "ENTRADA_ETAPA", activo: true, workflow: { estado: "PUBLICADO" } },
      select: { workflowId: true },
    });
    if (asignacion) {
      const [origen, conversacion, contacto] = await Promise.all([
        h.ejecucionWorkflowId
          ? prisma.workflowEjecucion.findUnique({ where: { id: h.ejecucionWorkflowId }, select: { profundidad: true } })
          : null,
        prisma.oportunidadConversacion.findFirst({
          where: { oportunidadId: h.oportunidadId, esActiva: true },
          orderBy: { creadoEn: "desc" },
          select: { conversacionId: true },
        }),
        prisma.oportunidadContacto.findFirst({
          where: { oportunidadId: h.oportunidadId, principal: true },
          select: { contactoId: true },
        }),
      ]);
      const r = await crearEjecucion({
        instanciaId: h.instanciaId,
        workflowId: asignacion.workflowId,
        disparador: "ENTRADA_ETAPA",
        claveIdempotencia: `etapa:${h.id}`,
        oportunidadId: h.oportunidadId,
        conversacionId: conversacion?.conversacionId ?? null,
        contactoId: contacto?.contactoId ?? null,
        stageId: h.stageNuevoId,
        ejecucionOrigenId: h.ejecucionWorkflowId,
        // Un movimiento manual o de un disparador reinicia la cadena; uno
        // hecho por un Workflow la continúa (límite contra bucles entre etapas).
        profundidad: origen ? origen.profundidad + 1 : 0,
      });
      if (!r.ejecucionId) console.warn(`[workflows] No se inició el Workflow de la etapa (historial ${h.id}): ${r.motivo}`);
      if (r.ejecucionId && r.creada) await avanzarEjecucion(r.ejecucionId);
    }
  }

  await prisma.oportunidadHistorialEtapa.update({ where: { id: h.id }, data: { procesadoWorkflowEn: new Date() } });
}

// ── Ciclo del worker ────────────────────────────────────────────────────────

const LOTE = 50;
/** Margen para que el camino por evento procese antes que el respaldo. */
const MARGEN_RESPALDO_MS = 30_000;

export async function cicloWorkflows(ahora: Date = new Date()) {
  const resumen = { vencidas: 0, recuperadas: 0, mensajes: 0, etapas: 0 };

  // Solo empresas con Workflows activos: al desactivarlos, sus ejecuciones
  // quedan detenidas donde están y se reanudan si se vuelven a activar.
  const instancias = (
    await prisma.configuracionEmpresa.findMany({ where: { workflowsHabilitado: true }, select: { instanciaId: true } })
  ).map((c) => c.instanciaId);
  if (instancias.length === 0) {
    // Igual se marcan los movimientos de etapa como procesados (sin efecto).
    await prisma.oportunidadHistorialEtapa.updateMany({
      where: { procesadoWorkflowEn: null, creadoEn: { lt: new Date(ahora.getTime() - MARGEN_RESPALDO_MS) } },
      data: { procesadoWorkflowEn: ahora },
    });
    return resumen;
  }

  // 1. Esperas vencidas: timers, timeouts de respuesta, inactividad de la IA y reintentos.
  const vencidas = await prisma.workflowEjecucion.findMany({
    where: {
      instanciaId: { in: instancias },
      estado: { in: ["ESPERANDO_TIMER", "ESPERANDO_RESPUESTA", "IA_ACTIVA", "ESPERANDO_ACCION_EXTERNA"] },
      esperaHasta: { lte: ahora },
      OR: [{ bloqueadoHasta: null }, { bloqueadoHasta: { lt: ahora } }],
    },
    orderBy: { esperaHasta: "asc" },
    take: LOTE,
    select: { id: true, esperaTipo: true },
  });
  for (const ej of vencidas) {
    await avanzarEjecucion(ej.id, ej.esperaTipo === "REINTENTO" ? undefined : { tipo: "TIMER_VENCIDO" }, ahora);
    resumen.vencidas++;
  }

  // 2. Ejecuciones en curso sin dueño: recién creadas por "Ejecutar otro
  //    Workflow" o interrumpidas porque el worker se cayó a mitad.
  const huerfanas = await prisma.workflowEjecucion.findMany({
    where: {
      instanciaId: { in: instancias },
      estado: "EJECUTANDO",
      OR: [
        { bloqueadoHasta: { lt: ahora } },
        { bloqueadoHasta: null, actualizadaEn: { lt: new Date(ahora.getTime() - 5_000) } },
      ],
    },
    take: LOTE,
    select: { id: true },
  });
  for (const ej of huerfanas) {
    await avanzarEjecucion(ej.id, undefined, ahora);
    resumen.recuperadas++;
  }

  // 3. Respaldo de mensajes cuyo evento se perdió: ejecución esperando y un
  //    mensaje del cliente posterior al inicio de la espera, no procesado.
  const limite = new Date(ahora.getTime() - MARGEN_RESPALDO_MS);
  const pendientes = await prisma.$queryRaw<{ id: string; mensajeId: string; contenido: string | null }[]>`
    SELECT e."id", m."id" AS "mensajeId", m."contenido"
    FROM "WorkflowEjecucion" e
    JOIN LATERAL (
      SELECT "id", "contenido", "creadoEn" FROM "MensajeConversacion"
      WHERE "conversacionId" = e."conversacionId" AND "remitente" = 'CONTACTO'
      ORDER BY "creadoEn" DESC LIMIT 1
    ) m ON true
    WHERE e."estado" IN ('ESPERANDO_RESPUESTA', 'IA_ACTIVA')
      AND e."instanciaId" = ANY(${instancias})
      AND e."esperaDesde" IS NOT NULL
      AND m."creadoEn" > e."esperaDesde"
      AND m."creadoEn" < ${limite}
      AND (e."ultimoMensajeProcesadoId" IS NULL OR e."ultimoMensajeProcesadoId" <> m."id")
    LIMIT ${LOTE}`;
  for (const p of pendientes) {
    await avanzarEjecucion(p.id, { tipo: "MENSAJE", mensajeId: p.mensajeId, texto: p.contenido ?? "" }, ahora);
    resumen.mensajes++;
  }

  // 4. Outbox de respaldo: movimientos de etapa cuyo evento no se procesó.
  const sinProcesar = await prisma.oportunidadHistorialEtapa.findMany({
    where: {
      procesadoWorkflowEn: null,
      creadoEn: { lt: limite, gt: new Date(ahora.getTime() - 24 * 60 * 60_000) },
    },
    orderBy: { creadoEn: "asc" },
    take: LOTE,
    select: { id: true },
  });
  for (const h of sinProcesar) {
    await procesarMovimientoEtapa(h.id);
    resumen.etapas++;
  }

  return resumen;
}
