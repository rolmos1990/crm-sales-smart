export type TipoCampo =
  | "TEXTO"
  | "TEXTO_LARGO"
  | "NUMERO"
  | "DECIMAL"
  | "FECHA"
  | "BOOLEANO"
  | "SELECT"
  | "MULTISELECT"
  | "EMAIL"
  | "TELEFONO"
  | "URL";

/** Campo personalizado a nivel de Pipeline (nuevo modelo) */
export interface CampoPersonalizadoPipeline {
  id: string;
  nombre: string;
  clave: string;
  tipo: TipoCampo;
  descripcion: string | null;
  opciones: string[] | null;
  orden: number;
  activo: boolean;
  pipelineId: string | null;
  visibleEn: string[];    // stageIds donde el campo es visible
  requeridoEn: string[];  // stageIds donde el campo es obligatorio
  bloqueadoEn: string[];  // stageIds donde el campo es solo lectura
}

/** @deprecated Usar CampoPersonalizadoPipeline */
export interface CampoPersonalizadoStage {
  id: string;
  nombre: string;
  clave: string;
  tipo: TipoCampo;
  requerido: boolean;
  bloqueado: boolean;
  descripcion: string | null;
  opciones: string[] | null;
  orden: number;
  activo: boolean;
  stageId: string | null;
  pipelineId: string | null;
}

export interface PipelineStage {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string | null;
  orden: number;
  probabilidad: number;
  esInicial: boolean;
  esGanado: boolean;
  esPerdido: boolean;
  activo: boolean;
  pipelineId: string;
}

export interface PipelineConStages {
  id: string;
  nombre: string;
  descripcion: string | null;
  esDefault: boolean;
  activo: boolean;
  stages: PipelineStage[];
  campos: CampoPersonalizadoPipeline[];
}

export interface OportunidadEnStage {
  id: string;
  titulo: string;
  valor: number;
  moneda: string;
  probabilidad: number;
  fechaCierre: Date | null;
  stageId: string | null;
  pipelineId: string | null;
  nuevoMensaje: boolean;
  empresa: { id: string; nombre: string } | null;
  tags: Array<{ tagId: string; tag: { id: string; nombre: string; color: string | null } }>;
}
