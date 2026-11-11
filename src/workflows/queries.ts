import { prisma } from "@/shared/db/prisma";

export async function obtenerWorkflows(instanciaId: string) {
  const filas = await prisma.workflow.findMany({
    where: { instanciaId },
    orderBy: [{ actualizadoEn: "desc" }],
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      estado: true,
      actualizadoEn: true,
      versionPublicada: { select: { numero: true, publicadaEn: true } },
      asignaciones: {
        where: { activo: true },
        select: {
          id: true,
          disparador: true,
          stage: { select: { nombre: true, color: true, pipeline: { select: { nombre: true } } } },
        },
      },
    },
  });
  return filas;
}

export type WorkflowResumen = Awaited<ReturnType<typeof obtenerWorkflows>>[number];

export async function obtenerWorkflow(id: string, instanciaId: string) {
  return prisma.workflow.findFirst({
    where: { id, instanciaId },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      estado: true,
      borrador: true,
      actualizadoEn: true,
      versionPublicada: { select: { numero: true, publicadaEn: true } },
      asignaciones: {
        where: { activo: true },
        select: { id: true, disparador: true, stageId: true, pipelineId: true },
      },
    },
  });
}

export type WorkflowDetalle = NonNullable<Awaited<ReturnType<typeof obtenerWorkflow>>>;

/** Catálogos que necesitan los formularios de los nodos en el editor. */
export async function obtenerOpcionesEditor(instanciaId: string, workflowIdActual?: string) {
  const [pipelines, agentes, usuarios, etiquetas, workflows] = await Promise.all([
    prisma.pipeline.findMany({
      where: { instanciaId, activo: true },
      orderBy: [{ esDefault: "desc" }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        stages: {
          where: { activo: true },
          orderBy: { orden: "asc" },
          select: { id: true, nombre: true, color: true },
        },
      },
    }),
    prisma.agenteIAConfig.findMany({
      where: { instanciaId },
      orderBy: { creadoEn: "asc" },
      select: { id: true, nombreAgente: true, tipo: true, usuario: { select: { nombre: true } } },
    }),
    prisma.usuarioInstancia.findMany({
      where: { instanciaId, activo: true, usuario: { tipo: "USUARIO" } },
      orderBy: { usuario: { nombre: "asc" } },
      select: { id: true, usuario: { select: { nombre: true, email: true } } },
    }),
    prisma.tag.findMany({
      where: { instanciaId, activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, color: true },
    }),
    prisma.workflow.findMany({
      where: { instanciaId, estado: "PUBLICADO", ...(workflowIdActual && { id: { not: workflowIdActual } }) },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  return {
    pipelines,
    agentes: agentes.map((a) => ({ id: a.id, nombre: a.nombreAgente ?? a.usuario.nombre, tipo: a.tipo })),
    usuarios: usuarios.map((u) => ({ id: u.id, nombre: u.usuario.nombre, email: u.usuario.email })),
    etiquetas,
    workflows,
  };
}

export type OpcionesEditor = Awaited<ReturnType<typeof obtenerOpcionesEditor>>;

/** Workflow asignado a cada etapa de un pipeline (para el panel de configuración del pipeline). */
export async function obtenerAsignacionesPorPipeline(pipelineId: string, instanciaId: string) {
  return prisma.workflowAsignacion.findMany({
    where: { pipelineId, instanciaId, activo: true, disparador: "ENTRADA_ETAPA" },
    select: { stageId: true, workflowId: true },
  });
}

/** Si la empresa tiene Workflows activos y qué etapas responden hoy con IA (aviso D3). */
export async function obtenerEstadoWorkflowsEmpresa(instanciaId: string) {
  const [config, etapasConIA] = await Promise.all([
    prisma.configuracionEmpresa.findUnique({ where: { instanciaId }, select: { workflowsHabilitado: true } }),
    prisma.pipelineStage.findMany({
      where: { respuestaIAHabilitada: true, activo: true, pipeline: { instanciaId, activo: true } },
      select: { nombre: true, pipeline: { select: { nombre: true } } },
    }),
  ]);
  return {
    habilitado: config?.workflowsHabilitado === true,
    etapasConIA: etapasConIA.map((e) => `${e.pipeline.nombre} · ${e.nombre}`),
  };
}

/** Ejecuciones de Workflows de una oportunidad, con su recorrido (historial B6). */
export async function obtenerEjecucionesOportunidad(oportunidadId: string, instanciaId: string) {
  return prisma.workflowEjecucion.findMany({
    where: { oportunidadId, instanciaId },
    orderBy: { iniciadaEn: "desc" },
    take: 20,
    select: {
      id: true,
      estado: true,
      resultado: true,
      error: true,
      motivoCancelacion: true,
      disparador: true,
      iniciadaEn: true,
      finalizadaEn: true,
      esperaHasta: true,
      nodoActualId: true,
      workflow: { select: { id: true, nombre: true } },
      version: { select: { numero: true, definicion: true } },
      pasos: {
        orderBy: { ocurridoEn: "asc" },
        select: { id: true, nodoId: true, tipoNodo: true, estado: true, salida: true, error: true, ocurridoEn: true },
      },
    },
  });
}

export type EjecucionHistorial = Awaited<ReturnType<typeof obtenerEjecucionesOportunidad>>[number];

/** Workflow asignado a mensajes sin atención y los candidatos (Inicio acepta "Mensaje recibido"). */
export async function obtenerAsignacionMensajes(instanciaId: string) {
  const [actual, publicados] = await Promise.all([
    prisma.workflowAsignacion.findFirst({
      where: { instanciaId, disparador: "MENSAJE_RECIBIDO", activo: true },
      select: { workflowId: true },
    }),
    prisma.workflow.findMany({
      where: { instanciaId, estado: "PUBLICADO" },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, versionPublicada: { select: { definicion: true } } },
    }),
  ]);
  const { DefinicionWorkflowSchema, CONFIG_POR_TIPO } = await import("./definicion/schema");
  const candidatos = publicados.filter((w) => {
    const def = DefinicionWorkflowSchema.safeParse(w.versionPublicada?.definicion);
    const inicio = def.success ? def.data.nodos.find((n) => n.tipo === "INICIO") : undefined;
    const c = inicio ? CONFIG_POR_TIPO.INICIO.safeParse(inicio.config) : null;
    return !!c?.success && c.data.disparadoresAceptados.includes("MENSAJE_RECIBIDO");
  });
  return { workflowId: actual?.workflowId ?? null, candidatos: candidatos.map((w) => ({ id: w.id, nombre: w.nombre })) };
}
