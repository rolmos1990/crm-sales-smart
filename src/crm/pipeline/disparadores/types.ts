export type TipoAccionDisparador =
  | "CREAR_TAREA"
  | "CREAR_NOTA"
  | "WEBHOOK"
  | "ASIGNAR_USUARIO"
  | "ASIGNAR_ETIQUETA"
  | "MODIFICAR_CAMPO"
  | "CAMBIAR_ETAPA"
  | "CERRAR_OPORTUNIDAD";

export type EstadoDisparadorJob = "PENDIENTE" | "PROCESANDO" | "COMPLETADO" | "CANCELADO" | "FALLIDO";

export interface ConfigCrearTarea {
  titulo: string;
  descripcion?: string;
}

export interface ConfigCrearNota {
  contenido: string;
}

export interface ConfigWebhook {
  url: string;
  method?: "POST" | "GET";
  headers?: Record<string, string>;
}

export interface ConfigAsignarUsuario {
  usuarioId: string;
  usuarioNombre?: string;
}

export interface ConfigAsignarEtiqueta {
  tagId: string;
  tagNombre?: string;
}

export interface ConfigModificarCampo {
  modo: "campo_directo" | "metadata";
  clave: string;
  valor: string;
}

export interface ConfigCambiarEtapa {
  pipelineId: string;
  stageId: string;
  pipelineNombre?: string;
  stageNombre?: string;
}

// Solo se usa en disparadores de Flujo de Venta (pedidos). `resultado`
// indica a cuál etapa terminal de SU pipeline se mueve la oportunidad
// relacionada — la etapa concreta (esGanado/esPerdido) se resuelve en cada
// ejecución, no se guarda un stageId fijo.
export interface ConfigCerrarOportunidad {
  resultado: "GANADA" | "PERDIDA";
}

export type ConfigDisparador =
  | ConfigCrearTarea
  | ConfigCrearNota
  | ConfigWebhook
  | ConfigAsignarUsuario
  | ConfigAsignarEtiqueta
  | ConfigModificarCampo
  | ConfigCambiarEtapa
  | ConfigCerrarOportunidad;

export interface Disparador {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
  delayMinutos: number | null;
  tipo: TipoAccionDisparador;
  config: ConfigDisparador;
  stageId: string;
  pipelineId: string;
  creadoEn: Date;
}

export interface DisparadorJob {
  id: string;
  estado: EstadoDisparadorJob;
  ejecutarEn: Date;
  payload: Record<string, unknown>;
  resultado: Record<string, unknown> | null;
  error: string | null;
  procesadoEn: Date | null;
  creadoEn: Date;
  disparadorId: string;
  oportunidadId: string;
  stageId: string;
  pipelineId: string;
}

export interface DisparadorConJobs extends Disparador {
  jobs: Pick<DisparadorJob, "id" | "estado" | "ejecutarEn" | "creadoEn">[];
}

export const ETIQUETAS_TIPO: Record<TipoAccionDisparador, string> = {
  CREAR_TAREA: "Crear tarea",
  CREAR_NOTA: "Crear nota",
  WEBHOOK: "Webhook",
  ASIGNAR_USUARIO: "Asignar usuario",
  ASIGNAR_ETIQUETA: "Asignar etiqueta",
  MODIFICAR_CAMPO: "Modificar campo",
  CAMBIAR_ETAPA: "Cambiar etapa",
  CERRAR_OPORTUNIDAD: "Cerrar oportunidad relacionada",
};

export const ICONOS_TIPO: Record<TipoAccionDisparador, string> = {
  CREAR_TAREA: "CheckSquare",
  CREAR_NOTA: "FileText",
  WEBHOOK: "Webhook",
  ASIGNAR_USUARIO: "UserCheck",
  ASIGNAR_ETIQUETA: "Tag",
  MODIFICAR_CAMPO: "SlidersHorizontal",
  CAMBIAR_ETAPA: "ArrowRightCircle",
  CERRAR_OPORTUNIDAD: "Flag",
};
