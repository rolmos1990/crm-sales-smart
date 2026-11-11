"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import type { EstadoEjecucionWorkflow, ModoAtencionConversacion } from "@/generated/prisma/enums";
import { CATALOGO_NODOS } from "./definicion/catalogo-nodos";
import { DefinicionWorkflowSchema } from "./definicion/schema";
import { ESTADOS_ACTIVOS, cancelarEjecucion, crearEjecucion, pausarPorHumano, retomarEjecucion } from "./motor/motor";
import { registrarCambioAtencionChat } from "./motor/adaptadores";

// Selector "Atención" del Inbox y del chat de la oportunidad (D6): ver y
// cambiar quién atiende la conversación — humano, Workflow o automático.

export interface EstadoAtencion {
  modo: ModoAtencionConversacion;
  desde: Date | null;
  motivo: string | null;
  usuarioNombre: string | null;
  workflowsHabilitados: boolean;
  /** Ejecución que controla la conversación ahora. */
  ejecucion: { id: string; workflow: string; estado: EstadoEjecucionWorkflow; paso: string | null; esperaHasta: Date | null } | null;
  /** Ejecución pausada por atención humana que se puede retomar. */
  pausada: { id: string; workflow: string; paso: string | null } | null;
  workflows: { id: string; nombre: string }[];
}

function nombrePaso(definicion: unknown, nodoId: string | null): string | null {
  if (!nodoId) return null;
  const def = DefinicionWorkflowSchema.safeParse(definicion);
  const nodo = def.success ? def.data.nodos.find((n) => n.id === nodoId) : undefined;
  return nodo ? nodo.etiqueta?.trim() || CATALOGO_NODOS[nodo.tipo].etiqueta : null;
}

async function conversacionAutorizada(conversacionId: string, tipo: "ver" | "modificar") {
  const auth = await requirePermisoAction("inbox", tipo);
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const conv = await prisma.conversacion.findFirst({
    where: { id: conversacionId, instanciaId: auth.sesion.instanciaId },
    select: { id: true, contactoId: true, modoAtencion: true },
  });
  if (!conv) return { ok: false as const, error: "Conversación no encontrada" };
  return { ok: true as const, sesion: auth.sesion, conv };
}

export async function obtenerAtencionAction(conversacionId: string): Promise<EstadoAtencion | null> {
  const a = await conversacionAutorizada(conversacionId, "ver");
  if (!a.ok) return null;
  const instanciaId = a.sesion.instanciaId;

  const [conv, config, activa, pausada, workflows] = await Promise.all([
    prisma.conversacion.findUnique({
      where: { id: conversacionId },
      select: { modoAtencion: true, atencionDesde: true, atencionMotivo: true, atencionUsuarioId: true },
    }),
    prisma.configuracionEmpresa.findUnique({ where: { instanciaId }, select: { workflowsHabilitado: true } }),
    prisma.workflowEjecucion.findFirst({
      where: { conversacionId, instanciaId, controlaConversacion: true, estado: { in: ESTADOS_ACTIVOS } },
      orderBy: { iniciadaEn: "desc" },
      select: { id: true, estado: true, nodoActualId: true, esperaHasta: true, workflow: { select: { nombre: true } }, version: { select: { definicion: true } } },
    }),
    prisma.workflowEjecucion.findFirst({
      where: { conversacionId, instanciaId, estado: "TRANSFERIDA_HUMANO" },
      orderBy: { actualizadaEn: "desc" },
      select: { id: true, nodoActualId: true, workflow: { select: { nombre: true } }, version: { select: { definicion: true } } },
    }),
    prisma.workflow.findMany({ where: { instanciaId, estado: "PUBLICADO" }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  if (!conv) return null;

  const usuario = conv.atencionUsuarioId
    ? await prisma.usuarioInstancia.findFirst({ where: { id: conv.atencionUsuarioId, instanciaId }, select: { usuario: { select: { nombre: true } } } })
    : null;

  return {
    modo: conv.modoAtencion,
    desde: conv.atencionDesde,
    motivo: conv.atencionMotivo,
    usuarioNombre: usuario?.usuario.nombre ?? null,
    workflowsHabilitados: config?.workflowsHabilitado === true,
    ejecucion: activa
      ? { id: activa.id, workflow: activa.workflow.nombre, estado: activa.estado, paso: nombrePaso(activa.version.definicion, activa.nodoActualId), esperaHasta: activa.esperaHasta }
      : null,
    pausada: pausada ? { id: pausada.id, workflow: pausada.workflow.nombre, paso: nombrePaso(pausada.version.definicion, pausada.nodoActualId) } : null,
    workflows,
  };
}

export type AccionAtencion =
  | { accion: "HUMANO" }
  | { accion: "AUTOMATICO" }
  | { accion: "RETOMAR" }
  | { accion: "INICIAR"; workflowId: string };

export async function cambiarAtencionAction(
  conversacionId: string,
  cambio: AccionAtencion,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await conversacionAutorizada(conversacionId, "modificar");
  if (!a.ok) return a;
  const { sesion, conv } = a;
  const instanciaId = sesion.instanciaId;
  const ahora = new Date();

  if (cambio.accion === "HUMANO") {
    await prisma.conversacion.update({
      where: { id: conversacionId },
      data: {
        modoAtencion: "HUMANO",
        atencionDesde: ahora,
        atencionMotivo: "Tomada manualmente",
        atencionUsuarioId: sesion.usuarioInstanciaId ?? null,
        atencionEjecucionId: null,
      },
    });
    await pausarPorHumano(conversacionId);
    await registrarCambioAtencionChat(conversacionId, "HUMANO", "Tomada manualmente", sesion.nombre ?? null);
  } else if (cambio.accion === "AUTOMATICO") {
    await prisma.conversacion.update({
      where: { id: conversacionId },
      data: { modoAtencion: "AUTOMATICO", atencionDesde: ahora, atencionMotivo: null, atencionUsuarioId: null, atencionEjecucionId: null },
    });
    await registrarCambioAtencionChat(conversacionId, "AUTOMATICO", null, sesion.nombre ?? null);
  } else if (!(await prisma.configuracionEmpresa.findFirst({ where: { instanciaId, workflowsHabilitado: true }, select: { id: true } }))) {
    return { ok: false, error: "Los Workflows no están activos para la empresa" };
  } else if (cambio.accion === "RETOMAR") {
    const pausada = await prisma.workflowEjecucion.findFirst({
      where: { conversacionId, instanciaId, estado: "TRANSFERIDA_HUMANO" },
      orderBy: { actualizadaEn: "desc" },
      select: { id: true, workflow: { select: { nombre: true } } },
    });
    if (!pausada) return { ok: false, error: "No hay un Workflow pausado para retomar" };
    if (!(await retomarEjecucion(pausada.id))) return { ok: false, error: "Otra automatización ya controla esta conversación" };
    await registrarCambioAtencionChat(conversacionId, "WORKFLOW", `Retomado: ${pausada.workflow.nombre}`, sesion.nombre ?? null);
  } else {
    const wf = await prisma.workflow.findFirst({ where: { id: cambio.workflowId, instanciaId, estado: "PUBLICADO" }, select: { id: true, nombre: true } });
    if (!wf) return { ok: false, error: "El Workflow no existe o no está publicado" };

    // Reemplaza lo que estuviera atendiendo la conversación.
    const previas = await prisma.workflowEjecucion.findMany({
      where: { conversacionId, instanciaId, estado: { in: [...ESTADOS_ACTIVOS, "TRANSFERIDA_HUMANO"] } },
      select: { id: true },
    });
    for (const p of previas) await cancelarEjecucion(p.id, `Reemplazado por "${wf.nombre}" desde el Inbox`);
    await prisma.conversacion.update({
      where: { id: conversacionId },
      data: { modoAtencion: "AUTOMATICO", atencionUsuarioId: null, atencionEjecucionId: null },
    });

    const oportunidad = await prisma.oportunidadConversacion.findFirst({
      where: { conversacionId, esActiva: true },
      orderBy: { creadoEn: "desc" },
      select: { oportunidadId: true },
    });
    const r = await crearEjecucion({
      instanciaId,
      workflowId: wf.id,
      disparador: "MANUAL",
      claveIdempotencia: `manual:${conversacionId}:${ahora.getTime()}`,
      conversacionId,
      contactoId: conv.contactoId,
      oportunidadId: oportunidad?.oportunidadId ?? null,
    });
    if (!r.ejecucionId) return { ok: false, error: r.motivo ?? "No se pudo iniciar el Workflow" };
    // La ejecución queda EJECUTANDO y el worker la toma en su siguiente ciclo.
    await registrarCambioAtencionChat(conversacionId, "WORKFLOW", `Iniciado: ${wf.nombre}`, sesion.nombre ?? null);
  }

  revalidatePath("/crm/inbox");
  return { ok: true };
}
