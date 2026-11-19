import type {
  AccionComercial,
  IntencionCompra,
  NivelInteres,
  NivelRecuperacion,
  NivelUrgencia,
  PrioridadAnalisis,
  RelacionComercial,
  TipoEjecucionAnalisis,
} from "@/generated/prisma/enums";
import type { EstadoSeguimiento } from "@/crm/contactos/segmentacion/condiciones";
import type { IntencionComercial } from "@/ai/estrategia/tipos";

export type {
  AccionComercial,
  IntencionCompra,
  NivelRecuperacion,
  NivelUrgencia,
  PrioridadAnalisis,
  RelacionComercial,
  TipoEjecucionAnalisis,
};

export type MotivoMarcado =
  | "MENSAJE"
  | "INTERACCION"
  | "PEDIDO"
  | "COTIZACION"
  | "OPORTUNIDAD"
  | "CONTACTO"
  | "VENCIMIENTO"
  | "MANUAL"
  | "MANUAL_REINTENTO"
  | "SELECCION"
  | "SEGMENTO"
  | "RECONCILIACION"
  | "INICIAL"
  | "CRITERIO";

/** Lo que devuelve el reclamo de un lote: un contacto tomado con su versión. */
export interface ContactoReclamado {
  contactoId: string;
  versionReclamada: bigint;
  forzarIA: boolean;
  tipo: TipoEjecucionAnalisis;
  elegibleDesde: Date;
}

export interface EvaluacionPrevia {
  puntaje: number;
  ajusteIA: number | null;
  accionIA: AccionComercial | null;
  versionEvaluada: bigint;
  intencion: IntencionCompra | null;
  senales: string[];
  iaHasta: Date | null;
  evaluadoIAEn: Date | null;
  noContactarResueltoEn: Date | null;
  interesSugerido: NivelInteres | null;
  interesSugeridoEstado: string | null;
}

/** Datos de un contacto cargados en bloque para un lote (datos-lote.ts). */
export interface DatosContactoLote {
  contactoId: string;
  creadoEn: Date;
  ultimaInteraccionEn: Date | null;
  esperandoRespuesta: boolean;
  noContactar: boolean;
  nivelInteres: NivelInteres;
  nivelInteresFijado: boolean;
  compras: number;
  valorCompras: number;
  ultimaCompraEn: Date | null;
  cotizacionesActivas: number;
  oportunidadesAbiertas: number;
  tieneActividadVencida: boolean;
  tieneActividadVigente: boolean;
  proximaActividadEn: Date | null;
  esCliente: boolean;
  esInteresado: boolean;
  seguimiento: EstadoSeguimiento;
  /** Último mensaje de sus conversaciones; la IA solo entra si es posterior a `iaHasta`. */
  ultimoMensajeEn: Date | null;
  evaluacionPrevia: EvaluacionPrevia | null;
}

export interface ResultadoReglas {
  relacionComercial: RelacionComercial;
  puntajeBase: number;
  senales: string[];
  motivos: string[];
  accion: AccionComercial;
  proximaEvaluacionEn: Date | null;
}

/** Interpretación de la IA de un contacto, ya validada (src/ai/analisis-contactos/salida.ts). */
export interface ResultadoIAContacto {
  intencion: IntencionCompra;
  intencionComercial: IntencionComercial | null;
  urgencia: NivelUrgencia;
  recuperacion: NivelRecuperacion;
  ajustePuntaje: number;
  senales: string[];
  objeciones: string[];
  motivos: string[];
  accionSugerida: AccionComercial;
  sugerirNoContactar: boolean;
  motivoNoContactar: string | null;
  productosConsultados: string[];
  presupuestoConocido: string | null;
  ocasionActual: string | null;
  fechaRequerida: string | null;
}

/** Lo que el ejecutor de IA necesita de cada contacto del lote. */
export interface ContactoParaIA {
  contactoId: string;
  datos: DatosContactoLote;
  reglas: ResultadoReglas;
  /** Fecha del último mensaje que la IA verá; pasa a ser `iaHasta`. */
  datosHasta: Date | null;
}

export interface EntradaLoteIA {
  instanciaId: string;
  idioma: string;
  criterio: import("./criterio/schema").CriterioContenido;
  contactos: ContactoParaIA[];
}

export interface RespuestaLoteIA {
  resultados: Map<string, ResultadoIAContacto>;
  invalidos: string[];
  omitidos: string[];
  loteInvalido: boolean;
  tokensEntrada: number;
  tokensSalida: number;
  tokensCacheados: number;
  costoEstimado: number | null;
  usoIAId: string | null;
  proveedorIAId: string | null;
  proveedor: string | null;
  modelo: string | null;
  promptVersion: string;
}

/**
 * Ejecutor de IA inyectable (research D17): el motor no depende del gateway
 * de forma directa, así el simulador de carga y los tests corren sin
 * llamadas reales y sin agregar un proveedor falso al enum de producción.
 */
export type EjecutorIA = (entrada: EntradaLoteIA) => Promise<RespuestaLoteIA>;
