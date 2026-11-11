// Sin "use server": este módulo NO debe llevar esa directiva porque
// `moverOportunidadAEtapa` deliberadamente saltea el chequeo de permisos de
// sesión — un archivo "use server" convierte automáticamente TODA función
// exportada en un Server Action invocable directamente desde el cliente.
// Vivir fuera de actions.ts es lo que mantiene estas funciones como un
// detalle de implementación interno, nunca como un endpoint público. Los
// llamadores desde el cliente pasan por `moverAStage` (pipeline/actions.ts) o
// `actualizarOportunidad`, que sí validan el permiso.
import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { publicadorEventos } from "@/shared/rabbitmq";
import { EventosSistema } from "@/eventos/catalogo";
import type { OrigenMovimientoEtapaPayload } from "@/eventos/contratos/oportunidad-movida-de-etapa.event";
import { procesarCambioStage } from "./disparadores/motor";

export type OrigenMovimientoEtapa = OrigenMovimientoEtapaPayload;

export interface OrigenMovimiento {
  tipo: OrigenMovimientoEtapa;
  usuarioId?: string | null;
  ejecucionWorkflowId?: string | null;
}

export interface MovimientoEtapa {
  oportunidadId: string;
  stageId: string;
  pipelineId: string;
  /** Si viene, la oportunidad DEBE pertenecer a esta instancia. */
  instanciaId?: string;
  origen: OrigenMovimiento;
  motivo?: string;
  /** Default true. Solo se desactiva para cierres automáticos del sistema
   *  (p.ej. CERRAR_OPORTUNIDAD desde un pedido), que nunca validaron campos. */
  validarCamposRequeridos?: boolean;
}

export type ResultadoMovimiento =
  | { exito: true; historialId: string | null }
  | { exito: false; error: string };

// Cadenas de disparadores "Cambiar etapa" que se llaman entre sí (A→B→A…)
// correrían para siempre, una vuelta cada ciclo del worker.
const MAX_MOVIMIENTOS_AUTOMATICOS_POR_HORA = 20;

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

function revalidarVistas() {
  // revalidatePath solo funciona dentro de un request de Next.js; desde el
  // worker o un webhook lanza. Es "best effort": nunca debe tirar abajo un
  // movimiento que ya se guardó.
  try {
    revalidatePath("/crm/pipeline");
    revalidatePath("/crm/oportunidades");
    revalidatePath("/crm/inbox");
  } catch { /* fuera de request context */ }
}

async function publicarMovimiento(datos: {
  instanciaId: string;
  oportunidadId: string;
  pipelineId: string;
  stageAnteriorId: string | null;
  stageNuevoId: string;
  historialId: string;
  origen: OrigenMovimiento;
}) {
  // El historial ya quedó guardado; si RabbitMQ falla, el motor de Workflows
  // lo recupera desde `procesadoWorkflowEn` (outbox de respaldo).
  try {
    await publicadorEventos.publicar(EventosSistema.OportunidadMovidaDeEtapa, datos.instanciaId, {
      version: 1,
      instanciaId: datos.instanciaId,
      oportunidadId: datos.oportunidadId,
      pipelineId: datos.pipelineId,
      stageAnteriorId: datos.stageAnteriorId,
      stageNuevoId: datos.stageNuevoId,
      historialId: datos.historialId,
      origen: datos.origen.tipo,
      usuarioId: datos.origen.usuarioId ?? null,
    });
  } catch (err) {
    console.error("[moverOportunidadAEtapa] Error al publicar OportunidadMovidaDeEtapa:", err);
  }
}

/**
 * Único camino para cambiar la etapa (`stageId`) de una oportunidad
 * existente. Kanban, selector del Inbox, disparadores y automatizaciones
 * pasan por acá para que todos hagan lo mismo: validar campos requeridos,
 * actualizar probabilidad/fechas, guardar historial, cerrar conversaciones
 * en etapas terminales, cancelar pendientes de la etapa anterior, encolar los
 * disparadores de la nueva y publicar OportunidadMovidaDeEtapa.
 */
export async function moverOportunidadAEtapa(mov: MovimientoEtapa): Promise<ResultadoMovimiento> {
  const { oportunidadId, stageId, pipelineId, origen } = mov;
  try {
    const [oportunidad, stage] = await Promise.all([
      prisma.oportunidad.findUnique({
        where: { id: oportunidadId },
        select: { instanciaId: true, stageId: true, pipelineId: true, metadata: true },
      }),
      prisma.pipelineStage.findUnique({
        where: { id: stageId },
        select: {
          nombre: true,
          probabilidad: true,
          esGanado: true,
          esPerdido: true,
          pipelineId: true,
          pipeline: { select: { instanciaId: true } },
        },
      }),
    ]);

    if (!oportunidad || (mov.instanciaId && oportunidad.instanciaId !== mov.instanciaId)) {
      return { exito: false, error: "Oportunidad no encontrada" };
    }
    const instanciaPipeline = stage?.pipeline.instanciaId;
    if (
      !stage ||
      stage.pipelineId !== pipelineId ||
      (instanciaPipeline && oportunidad.instanciaId && instanciaPipeline !== oportunidad.instanciaId)
    ) {
      return { exito: false, error: "Etapa no encontrada" };
    }

    // Soltar en la misma columna no es un movimiento: no se repiten
    // disparadores ni se ensucia el historial.
    if (oportunidad.stageId === stageId && oportunidad.pipelineId === pipelineId) {
      return { exito: true, historialId: null };
    }

    const instanciaId = oportunidad.instanciaId ?? instanciaPipeline ?? null;
    if (!instanciaId) return { exito: false, error: "Oportunidad sin instancia" };

    if (origen.tipo === "DISPARADOR" || origen.tipo === "WORKFLOW") {
      const recientes = await prisma.oportunidadHistorialEtapa.count({
        where: {
          oportunidadId,
          origen: { in: ["DISPARADOR", "WORKFLOW"] },
          creadoEn: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });
      if (recientes >= MAX_MOVIMIENTOS_AUTOMATICOS_POR_HORA) {
        return {
          exito: false,
          error: `Se detuvo el cambio automático de etapa: más de ${MAX_MOVIMIENTOS_AUTOMATICOS_POR_HORA} movimientos automáticos en la última hora (posible ciclo entre etapas)`,
        };
      }
    }

    if (mov.validarCamposRequeridos !== false) {
      const campos = await prisma.campoPersonalizado.findMany({
        where: { pipelineId, activo: true },
        select: { nombre: true, clave: true, requeridoEn: true },
      });
      const metadata = (oportunidad.metadata as Record<string, unknown>) ?? {};
      const faltantes = campos
        .filter((c) => Array.isArray(c.requeridoEn) && (c.requeridoEn as string[]).includes(stageId))
        .filter((c) => {
          const v = metadata[c.clave];
          return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
        })
        .map((c) => c.nombre);
      if (faltantes.length > 0) {
        return {
          exito: false,
          error: `Para avanzar a "${stage.nombre}" debes completar: ${faltantes.join(", ")}`,
        };
      }
    }

    const ahora = new Date();
    const [, historial] = await prisma.$transaction([
      prisma.oportunidad.update({
        where: { id: oportunidadId },
        data: {
          stageId,
          pipelineId,
          probabilidad: stage.probabilidad,
          ...(stage.esGanado && { etapa: "GANADO", fechaGanada: ahora }),
          ...(stage.esPerdido && { etapa: "PERDIDO", fechaPerdida: ahora }),
        },
      }),
      prisma.oportunidadHistorialEtapa.create({
        data: {
          oportunidadId,
          instanciaId,
          pipelineId,
          stageAnteriorId: oportunidad.stageId,
          stageNuevoId: stageId,
          origen: origen.tipo,
          usuarioId: origen.usuarioId ?? null,
          ejecucionWorkflowId: origen.ejecucionWorkflowId ?? null,
          motivo: mov.motivo ?? null,
        },
        select: { id: true },
      }),
    ]);

    if (stage.esGanado || stage.esPerdido) {
      await cerrarConversacionesDeOportunidad(oportunidadId);
    }

    await procesarCambioStage(oportunidadId, stageId, pipelineId);

    await publicarMovimiento({
      instanciaId,
      oportunidadId,
      pipelineId,
      stageAnteriorId: oportunidad.stageId,
      stageNuevoId: stageId,
      historialId: historial.id,
      origen,
    });

    revalidarVistas();
    return { exito: true, historialId: historial.id };
  } catch (err) {
    console.error("[moverOportunidadAEtapa] Error:", err);
    return { exito: false, error: "Error al mover la oportunidad" };
  }
}

/**
 * Para oportunidades que se CREAN ya dentro de una etapa: no hay movimiento
 * que validar, pero sí historial, disparadores de la etapa inicial y evento,
 * igual que si hubieran entrado moviéndose.
 */
export async function registrarEntradaInicialAEtapa(entrada: {
  oportunidadId: string;
  stageId: string;
  pipelineId: string;
  instanciaId: string;
  origen: OrigenMovimiento;
  motivo?: string;
}): Promise<void> {
  try {
    const historial = await prisma.oportunidadHistorialEtapa.create({
      data: {
        oportunidadId: entrada.oportunidadId,
        instanciaId: entrada.instanciaId,
        pipelineId: entrada.pipelineId,
        stageAnteriorId: null,
        stageNuevoId: entrada.stageId,
        origen: entrada.origen.tipo,
        usuarioId: entrada.origen.usuarioId ?? null,
        ejecucionWorkflowId: entrada.origen.ejecucionWorkflowId ?? null,
        motivo: entrada.motivo ?? null,
      },
      select: { id: true },
    });

    await procesarCambioStage(entrada.oportunidadId, entrada.stageId, entrada.pipelineId);

    await publicarMovimiento({
      instanciaId: entrada.instanciaId,
      oportunidadId: entrada.oportunidadId,
      pipelineId: entrada.pipelineId,
      stageAnteriorId: null,
      stageNuevoId: entrada.stageId,
      historialId: historial.id,
      origen: entrada.origen,
    });
  } catch (err) {
    // La oportunidad ya existe; un fallo acá no debe deshacer su creación.
    console.error("[registrarEntradaInicialAEtapa] Error:", err);
  }
}
