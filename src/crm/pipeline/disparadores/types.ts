export type TipoAccionDisparador = "CREAR_TAREA" | "CREAR_NOTA" | "WEBHOOK" | "ASIGNAR_USUARIO";
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

export type ConfigDisparador =
  | ConfigCrearTarea
  | ConfigCrearNota
  | ConfigWebhook
  | ConfigAsignarUsuario;

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
};

export const ICONOS_TIPO: Record<TipoAccionDisparador, string> = {
  CREAR_TAREA: "CheckSquare",
  CREAR_NOTA: "FileText",
  WEBHOOK: "Webhook",
  ASIGNAR_USUARIO: "UserCheck",
};
