"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { Prisma } from "@/generated/prisma/client";
import { DefinicionWorkflowSchema, CONFIG_POR_TIPO } from "./definicion/schema";
import { validarParaPublicar, type ResultadoValidacion } from "./definicion/validador";
import { crearConsultasReferencias } from "./definicion/consultas-referencias";
import { AsignarWorkflowEtapaSchema, DatosWorkflowSchema, definicionInicial } from "./schema";

type Resultado<T = undefined> = { exito: true; datos: T } | { exito: false; error: string };

const NO_ENCONTRADO = "Workflow no encontrado";

function revalidar(id?: string) {
  revalidatePath("/crm/workflows");
  if (id) revalidatePath(`/crm/workflows/${id}`);
}

function errorNombreDuplicado(e: unknown): string | null {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
    ? "Ya existe un Workflow con ese nombre"
    : null;
}

async function autorizar(tipo: "ver" | "modificar" = "modificar") {
  return requirePermisoAction("workflows", tipo);
}

async function workflowDeInstancia(id: string, instanciaId: string) {
  return prisma.workflow.findFirst({
    where: { id, instanciaId },
    select: { id: true, nombre: true, descripcion: true, borrador: true, estado: true, versionPublicadaId: true },
  });
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function crearWorkflow(datos: unknown): Promise<Resultado<{ id: string }>> {
  const auth = await autorizar();
  if (!auth.ok) return { exito: false, error: auth.error };
  const parsed = DatosWorkflowSchema.safeParse(datos);
  if (!parsed.success) return { exito: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const wf = await prisma.workflow.create({
      data: {
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion || null,
        borrador: definicionInicial() as unknown as Prisma.InputJsonValue,
        instanciaId: auth.sesion.instanciaId,
        creadoPorId: auth.sesion.usuarioId,
        actualizadoPorId: auth.sesion.usuarioId,
      },
      select: { id: true },
    });
    revalidar();
    return { exito: true, datos: { id: wf.id } };
  } catch (e) {
    return { exito: false, error: errorNombreDuplicado(e) ?? "Error al crear el Workflow" };
  }
}

export async function actualizarDatosWorkflow(id: string, datos: unknown): Promise<Resultado> {
  const auth = await autorizar();
  if (!auth.ok) return { exito: false, error: auth.error };
  const parsed = DatosWorkflowSchema.safeParse(datos);
  if (!parsed.success) return { exito: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const { count } = await prisma.workflow.updateMany({
      where: { id, instanciaId: auth.sesion.instanciaId },
      data: { nombre: parsed.data.nombre, descripcion: parsed.data.descripcion || null, actualizadoPorId: auth.sesion.usuarioId },
    });
    if (count === 0) return { exito: false, error: NO_ENCONTRADO };
    revalidar(id);
    return { exito: true, datos: undefined };
  } catch (e) {
    return { exito: false, error: errorNombreDuplicado(e) ?? "Error al actualizar el Workflow" };
  }
}

/** Guarda el borrador tal cual (puede estar incompleto); publicar lo valida. */
export async function guardarBorradorWorkflow(id: string, definicion: unknown): Promise<Resultado<{ actualizadoEn: Date }>> {
  const auth = await autorizar();
  if (!auth.ok) return { exito: false, error: auth.error };
  const parsed = DefinicionWorkflowSchema.safeParse(definicion);
  if (!parsed.success) return { exito: false, error: "La definición del Workflow no tiene un formato válido" };

  try {
    const existente = await workflowDeInstancia(id, auth.sesion.instanciaId);
    if (!existente) return { exito: false, error: NO_ENCONTRADO };
    const wf = await prisma.workflow.update({
      where: { id },
      data: { borrador: parsed.data as unknown as Prisma.InputJsonValue, actualizadoPorId: auth.sesion.usuarioId },
      select: { actualizadoEn: true },
    });
    return { exito: true, datos: { actualizadoEn: wf.actualizadoEn } };
  } catch {
    return { exito: false, error: "Error al guardar el borrador" };
  }
}

export async function validarWorkflow(id: string, definicion: unknown): Promise<Resultado<ResultadoValidacion>> {
  const auth = await autorizar("ver");
  if (!auth.ok) return { exito: false, error: auth.error };
  const existente = await workflowDeInstancia(id, auth.sesion.instanciaId);
  if (!existente) return { exito: false, error: NO_ENCONTRADO };
  const resultado = await validarParaPublicar(definicion, crearConsultasReferencias(auth.sesion.instanciaId), { workflowId: id });
  return { exito: true, datos: resultado };
}

/**
 * Guarda el borrador, lo valida y, si no hay errores, crea una versión nueva
 * e inmutable que pasa a ser la vigente. Las ejecuciones que ya corrían con
 * una versión anterior la siguen usando.
 */
export async function publicarWorkflow(
  id: string,
  definicion: unknown,
): Promise<Resultado<{ numero: number }> | { exito: false; error: string; validacion: ResultadoValidacion }> {
  const auth = await autorizar();
  if (!auth.ok) return { exito: false, error: auth.error };
  const parsed = DefinicionWorkflowSchema.safeParse(definicion);
  if (!parsed.success) return { exito: false, error: "La definición del Workflow no tiene un formato válido" };

  const existente = await workflowDeInstancia(id, auth.sesion.instanciaId);
  if (!existente) return { exito: false, error: NO_ENCONTRADO };

  const validacion = await validarParaPublicar(parsed.data, crearConsultasReferencias(auth.sesion.instanciaId), { workflowId: id });
  if (!validacion.valido) {
    await prisma.workflow.update({
      where: { id },
      data: { borrador: parsed.data as unknown as Prisma.InputJsonValue, actualizadoPorId: auth.sesion.usuarioId },
    });
    return { exito: false, error: `No se puede publicar: ${validacion.errores.length} error(es) por corregir`, validacion };
  }

  try {
    const numero = await prisma.$transaction(async (tx) => {
      const ultima = await tx.workflowVersion.findFirst({
        where: { workflowId: id },
        orderBy: { numero: "desc" },
        select: { numero: true },
      });
      const siguiente = (ultima?.numero ?? 0) + 1;
      const version = await tx.workflowVersion.create({
        data: {
          workflowId: id,
          instanciaId: auth.sesion.instanciaId,
          numero: siguiente,
          definicion: parsed.data as unknown as Prisma.InputJsonValue,
          publicadaPorId: auth.sesion.usuarioId,
        },
        select: { id: true },
      });
      await tx.workflow.update({
        where: { id },
        data: {
          borrador: parsed.data as unknown as Prisma.InputJsonValue,
          estado: "PUBLICADO",
          versionPublicadaId: version.id,
          actualizadoPorId: auth.sesion.usuarioId,
        },
      });
      return siguiente;
    });
    revalidar(id);
    return { exito: true, datos: { numero } };
  } catch {
    return { exito: false, error: "Error al publicar el Workflow" };
  }
}

export async function duplicarWorkflow(id: string): Promise<Resultado<{ id: string }>> {
  const auth = await autorizar();
  if (!auth.ok) return { exito: false, error: auth.error };
  const original = await workflowDeInstancia(id, auth.sesion.instanciaId);
  if (!original) return { exito: false, error: NO_ENCONTRADO };

  const existentes = new Set(
    (
      await prisma.workflow.findMany({
        where: { instanciaId: auth.sesion.instanciaId, nombre: { startsWith: original.nombre } },
        select: { nombre: true },
      })
    ).map((w) => w.nombre),
  );
  let nombre = `${original.nombre} (copia)`;
  for (let i = 2; existentes.has(nombre); i++) nombre = `${original.nombre} (copia ${i})`;

  try {
    const copia = await prisma.workflow.create({
      data: {
        nombre: nombre.slice(0, 80),
        descripcion: original.descripcion,
        borrador: original.borrador as Prisma.InputJsonValue,
        instanciaId: auth.sesion.instanciaId,
        creadoPorId: auth.sesion.usuarioId,
        actualizadoPorId: auth.sesion.usuarioId,
      },
      select: { id: true },
    });
    revalidar();
    return { exito: true, datos: { id: copia.id } };
  } catch (e) {
    return { exito: false, error: errorNombreDuplicado(e) ?? "Error al duplicar el Workflow" };
  }
}

/** Activar = volver a PUBLICADO (requiere versión publicada). Desactivar = INACTIVO: deja de iniciar ejecuciones nuevas. */
export async function cambiarEstadoWorkflow(id: string, activo: boolean): Promise<Resultado> {
  const auth = await autorizar();
  if (!auth.ok) return { exito: false, error: auth.error };
  const wf = await workflowDeInstancia(id, auth.sesion.instanciaId);
  if (!wf) return { exito: false, error: NO_ENCONTRADO };
  if (activo && !wf.versionPublicadaId) return { exito: false, error: "Publica el Workflow antes de activarlo" };

  await prisma.workflow.update({
    where: { id },
    data: { estado: activo ? "PUBLICADO" : "INACTIVO", actualizadoPorId: auth.sesion.usuarioId },
  });
  revalidar(id);
  revalidatePath("/crm/pipeline");
  return { exito: true, datos: undefined };
}

export async function eliminarWorkflow(id: string): Promise<Resultado> {
  const auth = await autorizar();
  if (!auth.ok) return { exito: false, error: auth.error };
  const wf = await workflowDeInstancia(id, auth.sesion.instanciaId);
  if (!wf) return { exito: false, error: NO_ENCONTRADO };

  const asignaciones = await prisma.workflowAsignacion.count({ where: { workflowId: id, activo: true } });
  if (asignaciones > 0) {
    return { exito: false, error: "Este Workflow está asignado a una o más etapas. Quítalo de las etapas antes de eliminarlo." };
  }
  // Otro Workflow publicado lo ejecuta con "Ejecutar otro Workflow".
  const versiones = await prisma.workflowVersion.findMany({
    where: { instanciaId: auth.sesion.instanciaId, vigenteDe: { isNot: null }, workflowId: { not: id } },
    select: { definicion: true, workflow: { select: { nombre: true } } },
  });
  const usadoPor = versiones.find((v) => {
    const def = DefinicionWorkflowSchema.safeParse(v.definicion);
    return def.success && def.data.nodos.some((n) => n.tipo === "EJECUTAR_WORKFLOW" && n.config.workflowId === id);
  });
  if (usadoPor) {
    return { exito: false, error: `El Workflow "${usadoPor.workflow.nombre}" lo ejecuta. Quita esa referencia antes de eliminarlo.` };
  }

  await prisma.workflow.delete({ where: { id } });
  revalidar();
  return { exito: true, datos: undefined };
}

// ── Asignación a etapas del pipeline ────────────────────────────────────────

function aceptaEntradaEtapa(definicion: unknown): boolean {
  return aceptaDisparador(definicion, "ENTRADA_ETAPA");
}

/** Asigna (o quita, con workflowId null) el Workflow que corre al entrar a una etapa. */
export async function asignarWorkflowAEtapa(datos: unknown): Promise<Resultado> {
  const auth = await autorizar();
  if (!auth.ok) return { exito: false, error: auth.error };
  const parsed = AsignarWorkflowEtapaSchema.safeParse(datos);
  if (!parsed.success) return { exito: false, error: "Datos inválidos" };
  const { pipelineId, stageId, workflowId } = parsed.data;
  const instanciaId = auth.sesion.instanciaId;

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipelineId, pipeline: { instanciaId } },
    select: { id: true },
  });
  if (!stage) return { exito: false, error: "Etapa no encontrada" };

  if (workflowId) {
    const wf = await prisma.workflow.findFirst({
      where: { id: workflowId, instanciaId, estado: "PUBLICADO" },
      select: { versionPublicada: { select: { definicion: true } } },
    });
    if (!wf?.versionPublicada) return { exito: false, error: "Solo se pueden asignar Workflows publicados y activos" };
    if (!aceptaEntradaEtapa(wf.versionPublicada.definicion)) {
      return { exito: false, error: 'El Inicio de este Workflow no acepta el evento "Entrada a una etapa"' };
    }
  }

  await prisma.$transaction([
    prisma.workflowAsignacion.updateMany({
      where: { stageId, instanciaId, activo: true, disparador: "ENTRADA_ETAPA" },
      data: { activo: false },
    }),
    ...(workflowId
      ? [
          prisma.workflowAsignacion.create({
            data: { workflowId, pipelineId, stageId, instanciaId, disparador: "ENTRADA_ETAPA" },
          }),
        ]
      : []),
  ]);
  revalidatePath("/crm/pipeline");
  revalidar();
  return { exito: true, datos: undefined };
}

export async function obtenerAsignacionesPipelineAction(pipelineId: string) {
  const auth = await autorizar("ver");
  if (!auth.ok) return { asignaciones: [], workflows: [] };
  const instanciaId = auth.sesion.instanciaId;
  const [asignaciones, workflows] = await Promise.all([
    prisma.workflowAsignacion.findMany({
      where: { pipelineId, instanciaId, activo: true, disparador: "ENTRADA_ETAPA" },
      select: { stageId: true, workflowId: true },
    }),
    prisma.workflow.findMany({
      where: { instanciaId, estado: "PUBLICADO" },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, versionPublicada: { select: { definicion: true } } },
    }),
  ]);
  return {
    asignaciones,
    workflows: workflows
      .filter((w) => aceptaEntradaEtapa(w.versionPublicada?.definicion))
      .map((w) => ({ id: w.id, nombre: w.nombre })),
  };
}


// ── Activación por empresa (D3) ─────────────────────────────────────────────

/**
 * Activa o desactiva los Workflows para la empresa. Activados: la IA solo
 * responde dentro de un nodo "Atención IA" (D3); la IA por etapa deja de
 * actuar (su configuración no se borra). Desactivados: todo vuelve a como era
 * y las ejecuciones quedan detenidas donde estaban.
 */
export async function cambiarWorkflowsEmpresaAction(habilitado: boolean): Promise<Resultado> {
  const auth = await autorizar();
  if (!auth.ok) return { exito: false, error: auth.error };
  const instanciaId = auth.sesion.instanciaId;
  await prisma.configuracionEmpresa.upsert({
    where: { instanciaId },
    create: { instanciaId, workflowsHabilitado: habilitado },
    update: { workflowsHabilitado: habilitado },
  });
  await prisma.eventoLog.create({
    data: {
      tipo: habilitado ? "WORKFLOWS_HABILITADOS" : "WORKFLOWS_DESHABILITADOS",
      payload: { usuarioId: auth.sesion.usuarioId },
      entidadTipo: "ConfiguracionEmpresa",
      entidadId: instanciaId,
      usuarioId: auth.sesion.usuarioId,
      instanciaId,
    },
  });
  revalidar();
  revalidatePath("/crm/pipeline");
  return { exito: true, datos: undefined };
}

export async function obtenerEjecucionesOportunidadAction(oportunidadId: string) {
  const auth = await requirePermisoAction("oportunidades", "ver");
  if (!auth.ok) return [];
  const { obtenerEjecucionesOportunidad } = await import("./queries");
  return obtenerEjecucionesOportunidad(oportunidadId, auth.sesion.instanciaId);
}

export async function cancelarEjecucionAction(ejecucionId: string): Promise<Resultado> {
  const auth = await autorizar();
  if (!auth.ok) return { exito: false, error: auth.error };
  const ej = await prisma.workflowEjecucion.findFirst({ where: { id: ejecucionId, instanciaId: auth.sesion.instanciaId }, select: { id: true } });
  if (!ej) return { exito: false, error: "Ejecución no encontrada" };
  const { cancelarEjecucion } = await import("./motor/motor");
  await cancelarEjecucion(ej.id, `Cancelada manualmente por ${auth.sesion.nombre}`);
  return { exito: true, datos: undefined };
}

function aceptaDisparador(definicion: unknown, disparador: "MENSAJE_RECIBIDO" | "ENTRADA_ETAPA"): boolean {
  const def = DefinicionWorkflowSchema.safeParse(definicion);
  const inicio = def.success ? def.data.nodos.find((n) => n.tipo === "INICIO") : undefined;
  const c = inicio ? CONFIG_POR_TIPO.INICIO.safeParse(inicio.config) : null;
  return !!c?.success && c.data.disparadoresAceptados.includes(disparador);
}

/** Workflow que atiende cada mensaje de una conversación sin automatización activa (null = ninguno). */
export async function asignarWorkflowMensajesAction(workflowId: string | null): Promise<Resultado> {
  const auth = await autorizar();
  if (!auth.ok) return { exito: false, error: auth.error };
  const instanciaId = auth.sesion.instanciaId;
  if (workflowId) {
    const wf = await prisma.workflow.findFirst({
      where: { id: workflowId, instanciaId, estado: "PUBLICADO" },
      select: { versionPublicada: { select: { definicion: true } } },
    });
    if (!wf?.versionPublicada) return { exito: false, error: "Solo se pueden asignar Workflows publicados y activos" };
    if (!aceptaDisparador(wf.versionPublicada.definicion, "MENSAJE_RECIBIDO")) {
      return { exito: false, error: 'El Inicio de este Workflow no acepta el evento "Mensaje recibido"' };
    }
  }
  await prisma.$transaction([
    prisma.workflowAsignacion.updateMany({
      where: { instanciaId, disparador: "MENSAJE_RECIBIDO", activo: true },
      data: { activo: false },
    }),
    ...(workflowId ? [prisma.workflowAsignacion.create({ data: { workflowId, instanciaId, disparador: "MENSAJE_RECIBIDO" } })] : []),
  ]);
  revalidar();
  return { exito: true, datos: undefined };
}
