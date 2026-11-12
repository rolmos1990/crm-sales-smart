import { hostname } from "node:os";
import { prisma } from "@/shared/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { EstadoEjecucionWorkflow, TipoDisparadorWorkflow } from "@/generated/prisma/enums";
import { obtenerZonaNegocio } from "@/shared/fechas/negocio";
import { CATALOGO_NODOS } from "../definicion/catalogo-nodos";
import { CONFIG_POR_TIPO, DefinicionWorkflowSchema, duracionEnMinutos, type DefinicionWorkflow, type MotivoInterrupcion } from "../definicion/schema";
import { crearAdaptadoresReales, registrarCambioAtencionChat } from "./adaptadores";
import { cargarContextoDatos, type ContextoDatos } from "./contexto";
import { EJECUTORES } from "./nodos";
import {
  ErrorDefinitivoWorkflow,
  type AdaptadoresEjecucion,
  type ContextoEjecucionGuardado,
  type EjecucionEnCurso,
  type EntradaReanudacion,
  type ResultadoNodo,
} from "./tipos";

// Motor de ejecución (docs/WORKFLOWS-PROPUESTA-ARQUITECTURA.md, B.4).
// Cada avance: toma un lease (sin locks largos), recorre nodos hasta una
// espera o un Fin, registra cada paso ANTES de su efecto (idempotencia) y
// persiste el estado. Nada vive en memoria entre avances: un reinicio del
// worker solo retrasa la ejecución hasta el siguiente ciclo.

const MAX_PASOS_POR_AVANCE = 50;
const DURACION_LEASE_MS = 2 * 60_000;
const MAX_REINTENTOS_NODO = 3;
const ESPERA_REINTENTO_MS = [60_000, 5 * 60_000, 15 * 60_000];
export const MAX_PROFUNDIDAD = 10;

const ESTADOS_FINALES: EstadoEjecucionWorkflow[] = ["COMPLETADA", "FALLIDA", "CANCELADA"];
export const ESTADOS_ACTIVOS: EstadoEjecucionWorkflow[] = [
  "EJECUTANDO",
  "ESPERANDO_RESPUESTA",
  "ESPERANDO_TIMER",
  "ESPERANDO_ACCION_EXTERNA",
  "IA_ACTIVA",
];

const ID_PROCESO = `${hostname()}-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;

let adaptadores: AdaptadoresEjecucion | null = null;
function deps(): AdaptadoresEjecucion {
  adaptadores ??= crearAdaptadoresReales(async ({ instanciaId, workflowId, origen, variables }) => {
    const r = await crearEjecucion({
      instanciaId,
      workflowId,
      disparador: "MANUAL",
      claveIdempotencia: `workflow:${origen.id}:${workflowId}`,
      oportunidadId: origen.oportunidadId,
      conversacionId: origen.conversacionId,
      contactoId: origen.contactoId,
      ejecucionOrigenId: origen.id,
      profundidad: origen.profundidad + 1,
      variables,
    });
    if (!r.ejecucionId) throw new ErrorDefinitivoWorkflow(r.motivo ?? "No se pudo iniciar el Workflow destino");
    // Queda EJECUTANDO sin lease: el worker la toma en su siguiente ciclo
    // (evita encadenar avances recursivos dentro de este).
    return { ejecucionId: r.ejecucionId };
  });
  return adaptadores;
}

/** Solo para tests y simulador. */
export function _usarAdaptadores(d: AdaptadoresEjecucion | null) {
  adaptadores = d;
}

function contextoInicial(variables: Record<string, string> = {}): ContextoEjecucionGuardado {
  return { variables, meta: { visitas: {}, intentos: {}, interaccionesIA: {} } };
}

function leerContexto(valor: unknown): ContextoEjecucionGuardado {
  const c = (valor ?? {}) as Partial<ContextoEjecucionGuardado>;
  return {
    variables: { ...(c.variables ?? {}) },
    meta: {
      visitas: { ...(c.meta?.visitas ?? {}) },
      intentos: { ...(c.meta?.intentos ?? {}) },
      interaccionesIA: { ...(c.meta?.interaccionesIA ?? {}) },
      ultimaEsperaDesde: c.meta?.ultimaEsperaDesde,
    },
  };
}

const jsonDe = (v: unknown) => v as Prisma.InputJsonValue;

// ── Crear ───────────────────────────────────────────────────────────────────

export interface ParamsCrearEjecucion {
  instanciaId: string;
  workflowId: string;
  disparador: TipoDisparadorWorkflow;
  claveIdempotencia: string;
  oportunidadId?: string | null;
  conversacionId?: string | null;
  contactoId?: string | null;
  stageId?: string | null;
  ejecucionOrigenId?: string | null;
  profundidad?: number;
  variables?: Record<string, string>;
}

/**
 * Crea una ejecución de la versión publicada vigente. Idempotente por
 * `claveIdempotencia`: repetir el mismo disparo devuelve la ya creada.
 */
export async function crearEjecucion(
  p: ParamsCrearEjecucion,
): Promise<{ ejecucionId: string | null; creada: boolean; motivo?: string }> {
  const profundidad = p.profundidad ?? 0;
  if (profundidad > MAX_PROFUNDIDAD) {
    return { ejecucionId: null, creada: false, motivo: "Demasiados Workflows encadenados (posible ciclo entre etapas o Workflows)" };
  }

  const existente = await prisma.workflowEjecucion.findUnique({ where: { claveIdempotencia: p.claveIdempotencia }, select: { id: true } });
  if (existente) return { ejecucionId: existente.id, creada: false };

  const wf = await prisma.workflow.findFirst({
    where: { id: p.workflowId, instanciaId: p.instanciaId, estado: "PUBLICADO" },
    select: { versionPublicada: { select: { id: true, definicion: true } } },
  });
  if (!wf?.versionPublicada) return { ejecucionId: null, creada: false, motivo: "El Workflow no está publicado o está inactivo" };

  const def = DefinicionWorkflowSchema.safeParse(wf.versionPublicada.definicion);
  const inicio = def.success ? def.data.nodos.find((n) => n.tipo === "INICIO") : undefined;
  if (!def.success || !inicio) return { ejecucionId: null, creada: false, motivo: "La versión publicada no es válida" };

  const enviaMensajes = def.data.nodos.some((n) => CATALOGO_NODOS[n.tipo].enviaMensajes);
  const controla = enviaMensajes && !!p.conversacionId;

  try {
    const ej = await prisma.$transaction(async (tx) => {
      const creada = await tx.workflowEjecucion.create({
        data: {
          instanciaId: p.instanciaId,
          workflowId: p.workflowId,
          versionId: wf.versionPublicada!.id,
          disparador: p.disparador,
          claveIdempotencia: p.claveIdempotencia,
          nodoActualId: inicio.id,
          contexto: jsonDe(contextoInicial(p.variables)),
          oportunidadId: p.oportunidadId ?? null,
          conversacionId: p.conversacionId ?? null,
          contactoId: p.contactoId ?? null,
          stageId: p.stageId ?? null,
          ejecucionOrigenId: p.ejecucionOrigenId ?? null,
          profundidad,
          controlaConversacion: controla,
        },
        select: { id: true },
      });
      // Toma el control de la conversación salvo que un humano la atienda:
      // en ese caso los pasos que envían mensajes quedan en pausa (D6).
      if (controla) {
        await tx.conversacion.updateMany({
          where: { id: p.conversacionId!, instanciaId: p.instanciaId, modoAtencion: { not: "HUMANO" } },
          data: { modoAtencion: "WORKFLOW", atencionEjecucionId: creada.id, atencionDesde: new Date(), atencionMotivo: null },
        });
      }
      return creada;
    });
    return { ejecucionId: ej.id, creada: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const otra = await prisma.workflowEjecucion.findUnique({ where: { claveIdempotencia: p.claveIdempotencia }, select: { id: true } });
      if (otra) return { ejecucionId: otra.id, creada: false };
      return { ejecucionId: null, creada: false, motivo: "Otra automatización ya controla esta conversación" };
    }
    throw e;
  }
}

// ── Lease ───────────────────────────────────────────────────────────────────

async function tomarLease(id: string, ahora: Date): Promise<boolean> {
  const hasta = new Date(ahora.getTime() + DURACION_LEASE_MS);
  const filas = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "WorkflowEjecucion"
    SET "bloqueadoHasta" = ${hasta}, "bloqueadoPor" = ${ID_PROCESO}
    WHERE "id" = ${id}
      AND ("bloqueadoHasta" IS NULL OR "bloqueadoHasta" < ${ahora})
      AND "estado" NOT IN ('COMPLETADA', 'FALLIDA', 'CANCELADA')
    RETURNING "id"`;
  return filas.length === 1;
}

async function liberarLease(id: string) {
  await prisma.workflowEjecucion.updateMany({
    where: { id, bloqueadoPor: ID_PROCESO },
    data: { bloqueadoHasta: null, bloqueadoPor: null },
  });
}

/** Devuelve la conversación al modo automático si esta ejecución la controlaba. */
async function liberarControl(ejecucionId: string, conversacionId: string | null) {
  if (!conversacionId) return;
  await prisma.conversacion.updateMany({
    where: { id: conversacionId, modoAtencion: "WORKFLOW", atencionEjecucionId: ejecucionId },
    data: { modoAtencion: "AUTOMATICO", atencionEjecucionId: null, atencionDesde: new Date() },
  });
}

// ── Avanzar ─────────────────────────────────────────────────────────────────

export type ResultadoAvance = EstadoEjecucionWorkflow | "OCUPADA" | "NO_ENCONTRADA";

export async function avanzarEjecucion(id: string, entrada?: EntradaReanudacion, ahora: Date = new Date()): Promise<ResultadoAvance> {
  if (!(await tomarLease(id, ahora))) {
    const existe = await prisma.workflowEjecucion.findUnique({ where: { id }, select: { estado: true } });
    return existe ? (ESTADOS_FINALES.includes(existe.estado) ? existe.estado : "OCUPADA") : "NO_ENCONTRADA";
  }
  try {
    return await avanzarConLease(id, entrada, ahora);
  } finally {
    await liberarLease(id);
  }
}

async function avanzarConLease(id: string, entradaInicial: EntradaReanudacion | undefined, ahora: Date): Promise<ResultadoAvance> {
  const ej = await prisma.workflowEjecucion.findUnique({
    where: { id },
    include: { version: { select: { definicion: true } } },
  });
  if (!ej) return "NO_ENCONTRADA";
  if (ESTADOS_FINALES.includes(ej.estado)) return ej.estado;

  // Reanudaciones fuera de lugar (el mismo mensaje llega por el evento y
  // por el respaldo de polling; un vencimiento que ya no aplica): se ignoran.
  if (entradaInicial?.tipo === "MENSAJE") {
    if (ej.ultimoMensajeProcesadoId === entradaInicial.mensajeId) return ej.estado;
    if (ej.estado !== "ESPERANDO_RESPUESTA" && ej.estado !== "IA_ACTIVA") return ej.estado;
    await prisma.workflowEjecucion.update({ where: { id }, data: { ultimoMensajeProcesadoId: entradaInicial.mensajeId } });
  }
  if (entradaInicial?.tipo === "TIMER_VENCIDO" && (!ej.esperaHasta || ej.esperaHasta > ahora)) return ej.estado;

  const def = DefinicionWorkflowSchema.safeParse(ej.version.definicion);
  if (!def.success) return fallar(ej.id, ej.conversacionId, "La versión del Workflow no es válida");
  const definicion: DefinicionWorkflow = def.data;

  const enCurso: EjecucionEnCurso = {
    id: ej.id,
    instanciaId: ej.instanciaId,
    workflowId: ej.workflowId,
    oportunidadId: ej.oportunidadId,
    conversacionId: ej.conversacionId,
    contactoId: ej.contactoId,
    profundidad: ej.profundidad,
    iniciadaEn: ej.iniciadaEn,
  };
  const contexto = leerContexto(ej.contexto);
  const zonaNegocio = await obtenerZonaNegocio(ej.instanciaId);
  let cacheDatos: Promise<ContextoDatos> | null = null;
  const datos = () => (cacheDatos ??= cargarContextoDatos(enCurso));

  let nodoActualId = ej.nodoActualId;
  let stageIdEjecucion = ej.stageId;
  let entrada = entradaInicial;
  let intentosNodo = ej.intentosNodo;
  let esperaDesde = ej.esperaDesde;
  let esperaHasta = ej.esperaHasta;

  for (let paso = 0; paso < MAX_PASOS_POR_AVANCE; paso++) {
    // D5: si la ejecución nació en una etapa y la oportunidad ya salió de
    // ella, nada de esa etapa debe seguir corriendo.
    if (stageIdEjecucion && ej.oportunidadId) {
      const op = await prisma.oportunidad.findUnique({ where: { id: ej.oportunidadId }, select: { stageId: true } });
      if (!op || op.stageId !== stageIdEjecucion) return cancelarInterno(ej.id, ej.conversacionId, "La oportunidad salió de la etapa");
    }

    const nodo = definicion.nodos.find((n) => n.id === nodoActualId);
    if (!nodo) return fallar(ej.id, ej.conversacionId, "El paso actual no existe en la versión publicada");

    // Atención humana: los pasos que escriben al cliente quedan en pausa
    // hasta que alguien retome el Workflow desde el Inbox (D6).
    if (CATALOGO_NODOS[nodo.tipo].enviaMensajes && ej.conversacionId && !entrada) {
      const conv = await prisma.conversacion.findUnique({ where: { id: ej.conversacionId }, select: { modoAtencion: true } });
      if (conv?.modoAtencion === "HUMANO") {
        await prisma.workflowEjecucion.update({
          where: { id: ej.id },
          data: { estado: "TRANSFERIDA_HUMANO", nodoActualId, contexto: jsonDe(contexto), esperaTipo: null, esperaHasta: null },
        });
        return "TRANSFERIDA_HUMANO";
      }
    }

    const esReanudacion = !!entrada;
    if (!esReanudacion) contexto.meta.visitas[nodo.id] = (contexto.meta.visitas[nodo.id] ?? 0) + 1;
    const iteracion = contexto.meta.visitas[nodo.id] ?? 1;

    // Idempotencia: el paso se registra antes del efecto. Si ya existía con
    // salida (el avance anterior se cortó después de ejecutarlo), se reusa
    // la salida sin repetir el efecto.
    let previo: { salida: string | null; estado: string } | null = null;
    if (!esReanudacion) {
      try {
        await prisma.workflowEjecucionPaso.create({
          data: { ejecucionId: ej.id, instanciaId: ej.instanciaId, nodoId: nodo.id, tipoNodo: nodo.tipo, iteracion, estado: "EJECUTANDO" },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
        previo = await prisma.workflowEjecucionPaso.findUnique({
          where: { ejecucionId_nodoId_iteracion: { ejecucionId: ej.id, nodoId: nodo.id, iteracion } },
          select: { salida: true, estado: true },
        });
      }
    }

    const inicioPaso = Date.now();
    let resultado: ResultadoNodo;
    if (previo?.estado === "OK" && previo.salida) {
      resultado = { tipo: "continuar", salida: previo.salida };
    } else {
      const ejecutor = EJECUTORES[nodo.tipo] as (typeof EJECUTORES)[keyof typeof EJECUTORES];
      const config = CONFIG_POR_TIPO[nodo.tipo].parse(nodo.config);
      const ctx = { ejecucion: enCurso, nodoId: nodo.id, iteracion, variables: contexto.variables, meta: contexto.meta, ahora, zonaNegocio, datos, deps: deps() };
      // "Mover etapa → seguir": la ejecución pasa a pertenecer a la etapa
      // destino ANTES de mover, para que ni la guarda de etapa ni el
      // suscriptor de OportunidadMovidaDeEtapa (D5) la cancelen.
      const sigueEnEtapaNueva =
        nodo.tipo === "MOVER_ETAPA" && !entrada && stageIdEjecucion && (config as { workflowActual: string }).workflowActual === "CONTINUAR";
      const etapaAnterior = stageIdEjecucion;
      if (sigueEnEtapaNueva) {
        stageIdEjecucion = (config as { stageId: string }).stageId;
        await prisma.workflowEjecucion.update({ where: { id: ej.id }, data: { stageId: stageIdEjecucion } });
      }
      try {
        resultado = entrada
          ? ejecutor.reanudar
            ? await ejecutor.reanudar(config as never, ctx, entrada)
            : { tipo: "continuar", salida: "siguiente" }
          : await ejecutor.ejecutar(config as never, ctx);
      } catch (e) {
        resultado = { tipo: "error", mensaje: e instanceof Error ? e.message : "Error desconocido", reintentable: !(e instanceof ErrorDefinitivoWorkflow) };
      }
      const movioEtapa = resultado.tipo === "continuar" && resultado.salida === "siguiente";
      if (sigueEnEtapaNueva && !movioEtapa) {
        stageIdEjecucion = etapaAnterior;
        await prisma.workflowEjecucion.update({ where: { id: ej.id }, data: { stageId: etapaAnterior } });
      }
    }
    entrada = undefined;
    const duracionMs = Date.now() - inicioPaso;
    const actualizarPaso = (data: Prisma.WorkflowEjecucionPasoUpdateInput) =>
      prisma.workflowEjecucionPaso.update({
        where: { ejecucionId_nodoId_iteracion: { ejecucionId: ej.id, nodoId: nodo.id, iteracion } },
        data: { ...data, duracionMs },
      });

    if (resultado.tipo === "continuar") {
      Object.assign(contexto.variables, resultado.variables ?? {});
      const conexion = definicion.conexiones.find((c) => c.origen === nodo.id && c.salida === resultado.salida);
      await actualizarPaso({ estado: "OK", salida: resultado.salida, resultado: resultado.resultado ? jsonDe(resultado.resultado) : undefined });
      if (!conexion) return fallar(ej.id, ej.conversacionId, `La salida "${resultado.salida}" no está conectada`);
      nodoActualId = conexion.destino;
      intentosNodo = 0;
      esperaDesde = null;
      esperaHasta = null;
      await prisma.workflowEjecucion.update({
        where: { id: ej.id },
        data: { estado: "EJECUTANDO", nodoActualId, contexto: jsonDe(contexto), intentosNodo, esperaTipo: null, esperaDesde: null, esperaHasta: null },
      });
      continue;
    }

    if (resultado.tipo === "esperar") {
      Object.assign(contexto.variables, resultado.variables ?? {});
      // Reanudación que sigue esperando (respuesta inválida): conserva el
      // inicio y el vencimiento originales.
      if (!esReanudacion || !esperaDesde) {
        esperaDesde = ahora;
        contexto.meta.ultimaEsperaDesde = ahora.toISOString();
        esperaHasta = resultado.hasta;
      } else if (resultado.hasta) {
        esperaHasta = resultado.hasta;
      }
      await actualizarPaso({ estado: "ESPERANDO", resultado: resultado.resultado ? jsonDe(resultado.resultado) : undefined });
      await prisma.workflowEjecucion.update({
        where: { id: ej.id },
        data: { estado: resultado.estado, nodoActualId, contexto: jsonDe(contexto), esperaTipo: resultado.espera, esperaDesde, esperaHasta, intentosNodo: 0 },
      });
      return resultado.estado;
    }

    if (resultado.tipo === "finalizar") {
      await actualizarPaso({ estado: "OK", salida: "fin", resultado: resultado.detalle ? jsonDe(resultado.detalle) : undefined });
      await prisma.workflowEjecucion.update({
        where: { id: ej.id },
        data: {
          estado: "COMPLETADA",
          resultado: resultado.resultado,
          nodoActualId,
          contexto: jsonDe(contexto),
          esperaTipo: null,
          esperaHasta: null,
          finalizadaEn: new Date(),
        },
      });
      await liberarControl(ej.id, ej.conversacionId);
      return "COMPLETADA";
    }

    // Error: reintento con espera si es transitorio; si no (o se agotaron),
    // sigue por la salida "error" del nodo si existe; si no, falla.
    await actualizarPaso({ estado: "ERROR", error: resultado.mensaje });
    intentosNodo += 1;
    if (resultado.reintentable && intentosNodo < MAX_REINTENTOS_NODO) {
      // Al vencer, el worker vuelve a entrar al nodo con una iteración nueva
      // (el paso fallido queda en el historial).
      await prisma.workflowEjecucion.update({
        where: { id: ej.id },
        data: {
          estado: "ESPERANDO_TIMER",
          esperaTipo: "REINTENTO",
          esperaDesde: ahora,
          esperaHasta: new Date(ahora.getTime() + ESPERA_REINTENTO_MS[intentosNodo - 1]),
          intentosNodo,
          nodoActualId,
          contexto: jsonDe(contexto),
          error: resultado.mensaje,
        },
      });
      return "ESPERANDO_TIMER";
    }
    const salidaError = definicion.conexiones.find((c) => c.origen === nodo.id && c.salida === "error");
    if (salidaError) {
      nodoActualId = salidaError.destino;
      intentosNodo = 0;
      await prisma.workflowEjecucion.update({
        where: { id: ej.id },
        data: { estado: "EJECUTANDO", nodoActualId, contexto: jsonDe(contexto), intentosNodo, error: resultado.mensaje },
      });
      continue;
    }
    return fallar(ej.id, ej.conversacionId, `${CATALOGO_NODOS[nodo.tipo].etiqueta}: ${resultado.mensaje}`);
  }

  return fallar(id, ej.conversacionId, `Se ejecutaron más de ${MAX_PASOS_POR_AVANCE} pasos seguidos sin una espera`);
}

async function fallar(id: string, conversacionId: string | null, error: string): Promise<"FALLIDA"> {
  await prisma.workflowEjecucion.update({
    where: { id },
    data: { estado: "FALLIDA", error, esperaTipo: null, esperaHasta: null, finalizadaEn: new Date() },
  });
  await liberarControl(id, conversacionId);
  return "FALLIDA";
}

async function cancelarInterno(id: string, conversacionId: string | null, motivo: string): Promise<"CANCELADA"> {
  await prisma.workflowEjecucion.updateMany({
    where: { id, estado: { notIn: ESTADOS_FINALES } },
    data: { estado: "CANCELADA", motivoCancelacion: motivo, esperaTipo: null, esperaHasta: null, finalizadaEn: new Date() },
  });
  await liberarControl(id, conversacionId);
  return "CANCELADA";
}

// ── Operaciones externas ────────────────────────────────────────────────────

/** Cancela una ejecución activa o pausada (no requiere lease: es terminal). */
export async function cancelarEjecucion(id: string, motivo: string) {
  const ej = await prisma.workflowEjecucion.findUnique({ where: { id }, select: { conversacionId: true, estado: true } });
  if (!ej || ESTADOS_FINALES.includes(ej.estado)) return;
  await cancelarInterno(id, ej.conversacionId, motivo);
}

/**
 * Política del Timer ante un evento durante la espera (cliente respondió,
 * cambio de etapa, oportunidad ganada, humano tomó la conversación).
 */
export async function aplicarInterrupcion(ejecucionId: string, motivo: MotivoInterrupcion, ahora: Date = new Date()) {
  const ej = await prisma.workflowEjecucion.findUnique({
    where: { id: ejecucionId },
    select: { estado: true, esperaTipo: true, nodoActualId: true, conversacionId: true, version: { select: { definicion: true } } },
  });
  if (!ej || ej.estado !== "ESPERANDO_TIMER" || ej.esperaTipo !== "TIMER") return;
  const def = DefinicionWorkflowSchema.safeParse(ej.version.definicion);
  const nodo = def.success ? def.data.nodos.find((n) => n.id === ej.nodoActualId) : undefined;
  if (nodo?.tipo !== "TIMER") return;
  const config = CONFIG_POR_TIPO.TIMER.safeParse(nodo.config);
  const accion = config.success ? config.data.politicas[motivo] ?? "CONTINUAR_ESPERANDO" : "CONTINUAR_ESPERANDO";

  if (accion === "CONTINUAR_ESPERANDO") return;
  if (accion === "CANCELAR_WORKFLOW") {
    await cancelarEjecucion(ejecucionId, `Timer cancelado: ${ETIQUETA_INTERRUPCION[motivo]}`);
    return;
  }
  await avanzarEjecucion(ejecucionId, { tipo: "INTERRUPCION", accion }, ahora);
}

const ETIQUETA_INTERRUPCION: Record<MotivoInterrupcion, string> = {
  CLIENTE_RESPONDE: "el cliente respondió",
  CAMBIO_ETAPA: "la oportunidad cambió de etapa",
  OPORTUNIDAD_GANADA: "la oportunidad se ganó",
  HUMANO_TOMA: "un agente tomó la conversación",
};

const ESTADO_DE_ESPERA = {
  TIMER: "ESPERANDO_TIMER",
  REINTENTO: "ESPERANDO_TIMER",
  RESPUESTA: "ESPERANDO_RESPUESTA",
  IA: "IA_ACTIVA",
  REVISION: "ESPERANDO_ACCION_EXTERNA",
} as const;

/**
 * Retoma una ejecución pausada por atención humana (D6). Si estaba en una
 * espera, vuelve a ella con el mismo vencimiento (si ya venció, el worker la
 * procesa en su siguiente ciclo); si no, sigue desde el paso donde quedó.
 */
export async function retomarEjecucion(id: string): Promise<boolean> {
  const ej = await prisma.workflowEjecucion.findUnique({
    where: { id },
    select: {
      estado: true,
      conversacionId: true,
      instanciaId: true,
      esperaTipo: true,
      nodoActualId: true,
      esperaDesde: true,
      version: { select: { definicion: true } },
    },
  });
  if (ej?.estado !== "TRANSFERIDA_HUMANO") return false;
  const estado = ej.esperaTipo ? ESTADO_DE_ESPERA[ej.esperaTipo] : "EJECUTANDO";
  const esperaIA = ej.esperaTipo === "IA" ? await reiniciarEsperaIA(ej) : {};
  try {
    await prisma.$transaction([
      prisma.workflowEjecucion.update({ where: { id }, data: { estado, controlaConversacion: !!ej.conversacionId, ...esperaIA } }),
      ...(ej.conversacionId
        ? [
            prisma.conversacion.update({
              where: { id: ej.conversacionId },
              data: { modoAtencion: "WORKFLOW", atencionEjecucionId: id, atencionDesde: new Date(), atencionMotivo: null, atencionUsuarioId: null },
            }),
          ]
        : []),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
  // No se avanza acá (puede llamarse desde una petición HTTP y un paso de IA
  // tarda): queda EJECUTANDO sin lease y el worker la toma en su ciclo.
  return true;
}

/**
 * Al retomar una Atención IA tras una pausa humana:
 * - la inactividad cuenta desde ahora (si no, una pausa más larga que la
 *   inactividad haría salir el nodo por "No resuelto" sin atender);
 * - la espera arranca en la última respuesta enviada al cliente, para que el
 *   respaldo de mensajes solo tome un mensaje del cliente que nadie contestó
 *   (no uno que el humano ya respondió durante la pausa).
 */
async function reiniciarEsperaIA(ej: {
  conversacionId: string | null;
  nodoActualId: string | null;
  esperaDesde: Date | null;
  version: { definicion: unknown };
}) {
  const ahora = new Date();
  const def = DefinicionWorkflowSchema.safeParse(ej.version.definicion);
  const nodo = def.success ? def.data.nodos.find((n) => n.id === ej.nodoActualId) : undefined;
  const config = nodo?.tipo === "ATENCION_IA" ? CONFIG_POR_TIPO.ATENCION_IA.safeParse(nodo.config) : null;
  const inactividad = config?.success ? config.data.inactividad : undefined;
  const ultimaRespuesta = ej.conversacionId
    ? await prisma.mensajeConversacion.findFirst({
        where: { conversacionId: ej.conversacionId, esNotaInterna: false, remitente: { in: ["AGENTE", "AGENTE_CANAL_NATIVO", "BOT"] } },
        orderBy: { creadoEn: "desc" },
        select: { creadoEn: true },
      })
    : null;
  return {
    esperaDesde: ultimaRespuesta?.creadoEn ?? ej.esperaDesde ?? ahora,
    esperaHasta: inactividad ? new Date(ahora.getTime() + duracionEnMinutos(inactividad) * 60_000) : null,
  };
}

/** Pausa la ejecución que controla una conversación cuando un humano la toma (D6). */
export async function pausarPorHumano(conversacionId: string) {
  const activas = await prisma.workflowEjecucion.findMany({
    where: { conversacionId, controlaConversacion: true, estado: { in: ESTADOS_ACTIVOS } },
    select: { id: true, estado: true, esperaTipo: true },
  });
  for (const ej of activas) {
    if (ej.estado === "ESPERANDO_TIMER" && ej.esperaTipo === "TIMER") await aplicarInterrupcion(ej.id, "HUMANO_TOMA");
    // Conserva la espera (tipo y vencimiento) para retomarla igual (D6).
    await prisma.workflowEjecucion.updateMany({
      where: { id: ej.id, estado: { in: ESTADOS_ACTIVOS } },
      data: { estado: "TRANSFERIDA_HUMANO" },
    });
  }
}

export { registrarCambioAtencionChat };
