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
  campos?: CampoPersonalizadoStage[];
}

export interface PipelineConStages {
  id: string;
  nombre: string;
  descripcion: string | null;
  esDefault: boolean;
  activo: boolean;
  stages: PipelineStage[];
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
  empresa: { id: string; nombre: string } | null;
  tags: Array<{ tagId: string; tag: { id: string; nombre: string; color: string | null } }>;
}
