export type EntidadImportable =
  | "CONTACTO"
  | "EMPRESA"
  | "OPORTUNIDAD"
  | "PEDIDO"
  | "PRODUCTO"
  | "ACTIVIDAD";

export type FormatoArchivo = "csv" | "xls" | "xlsx";

export type SeparadorCSV = ";" | "," | "|" | "\t";

export type AccionColumna = "mapear" | "crear" | "ignorar";

export type PasoWizard =
  | "tipo-datos"
  | "archivo"
  | "vista-previa"
  | "mapeo"
  | "validacion"
  | "importacion";

export interface DatosArchivo {
  nombre: string;
  tipo: FormatoArchivo;
  peso: number;
  separador?: SeparadorCSV;
  encabezados: string[];
  filas: Record<string, string>[];
  filasTotales: number;
}

export interface MapeoColumna {
  columnaArchivo: string;
  accion: AccionColumna;
  campoDestino?: string;
  campoCreadoId?: string;
}

export interface CampoNuevoImport {
  nombre: string;
  tipo: string;
  requerido: boolean;
}

export interface DefinicionCampo {
  clave: string;
  etiqueta: string;
  requerido: boolean;
  tipo: "texto" | "numero" | "fecha" | "email" | "telefono" | "enum";
  valoresEnum?: string[];
}

export interface CampoPersonalizadoResumen {
  id: string;
  nombre: string;
  clave: string;
  tipo: string;
}

export interface ErrorFila {
  fila: number;
  campo: string;
  mensaje: string;
  valor?: string;
}

export interface ResultadoValidacion {
  total: number;
  validos: number;
  conError: number;
  errores: ErrorFila[];
  filasValidas: Record<string, unknown>[];
  filasConError: Record<string, string>[];
}

export interface ResultadoImportacion {
  exitosos: number;
  conError: number;
  errores: ErrorFila[];
  historialId: string;
}

export interface EstadoWizard {
  paso: PasoWizard;
  entidad: EntidadImportable | null;
  archivo: DatosArchivo | null;
  mapeos: MapeoColumna[];
  soloValidos: boolean;
  validacion: ResultadoValidacion | null;
  resultado: ResultadoImportacion | null;
  cargando: boolean;
  estrategiaContacto: "email" | "telefono" | "email_o_telefono";
}
