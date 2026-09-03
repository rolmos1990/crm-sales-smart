// 024-alias-ubicaciones-transportistas — tipos del wizard de importación de
// destinos/tarifas (US4). No reutiliza EntidadImportable/PasoWizard de
// src/crm/datos/types.ts a propósito (research.md §7): ese dominio asume
// "mapear columnas a un modelo nuevo", este resuelve contra un catálogo
// existente con niveles de confianza.

export type PasoImportacionDestinos = "archivo" | "mapeo" | "revision" | "confirmacion";

// Columnas fijas del dominio (no configurables por el usuario, a diferencia
// de CAMPOS_POR_ENTIDAD — este dominio no tiene campos personalizados).
export const COLUMNAS_DESTINO = [
  "zonaNombre",
  "provinciaEstado",
  "distritoCiudad",
  "corregimiento",
  "sectorOCodigoPostal",
  "alias",
  "servicioNombre",
  "costoInterno",
  "precioCliente",
  "tiempoMinimoDias",
  "tiempoMaximoDias",
] as const;

export type ColumnaDestino = (typeof COLUMNAS_DESTINO)[number];

export const ETIQUETAS_COLUMNA_DESTINO: Record<ColumnaDestino, string> = {
  zonaNombre: "Nombre de la zona",
  provinciaEstado: "Provincia/Estado",
  distritoCiudad: "Distrito/Ciudad",
  corregimiento: "Corregimiento",
  sectorOCodigoPostal: "Sector/Código postal",
  alias: "Alias (separados por \";\")",
  servicioNombre: "Servicio",
  costoInterno: "Costo transportista",
  precioCliente: "Precio al cliente",
  tiempoMinimoDias: "Tiempo mínimo (días)",
  tiempoMaximoDias: "Tiempo máximo (días)",
};

export const COLUMNAS_DESTINO_REQUERIDAS: ColumnaDestino[] = [
  "zonaNombre",
  "provinciaEstado",
  "servicioNombre",
  "costoInterno",
  "precioCliente",
];

// Mapeo columna del archivo -> columna del dominio ("" = sin mapear/ignorar).
export type MapeoColumnasDestino = Record<string, ColumnaDestino | "">;

export type EstadoFilaImportDestino =
  | "NUEVO" // sin match en ningún nivel — crea ZonaEntregaUbicacion (y ZonaEntrega si zonaNombre no existe)
  | "COINCIDENCIA_EXACTA" // matchea EXACTA una ubicación existente — solo agrega/actualiza tarifa
  | "POSIBLE_DUPLICADO" // matchea PROBABLE una única ubicación existente — el usuario confirma o crea nuevo
  | "ALIAS_AMBIGUO" // el alias de la fila matchea 2+ ubicaciones distintas — bloquea hasta resolver
  | "INCOMPLETA"; // falta un campo requerido (FR-012 edge case)

export interface CandidatoRevisionDestino {
  zonaEntregaUbicacionId: string;
  zonaEntregaId: string;
  nombreVisible: string;
}

export interface FilaRevisionDestino {
  fila: number; // 1-indexed, para mensajes de error legibles
  datos: Record<ColumnaDestino, string>;
  estado: EstadoFilaImportDestino;
  candidatos: CandidatoRevisionDestino[]; // 1 para POSIBLE_DUPLICADO, 2+ para ALIAS_AMBIGUO
  motivo?: string; // por qué quedó INCOMPLETA, si aplica
}

// Decisión del usuario para una fila POSIBLE_DUPLICADO — "crear_nuevo" o el
// id del destino existente elegido. Las filas NUEVO/COINCIDENCIA_EXACTA no
// necesitan decisión (se incluyen automáticamente si el usuario no las
// desmarca); las ALIAS_AMBIGUO/INCOMPLETA no pueden confirmarse.
export type DecisionFilaDestino = { incluir: false } | { incluir: true; usarExistenteId?: string };

export interface ResumenRevisionDestinos {
  nuevos: number;
  coincidenciaExacta: number;
  posiblesDuplicados: number;
  aliasAmbiguos: number;
  incompletas: number;
}
