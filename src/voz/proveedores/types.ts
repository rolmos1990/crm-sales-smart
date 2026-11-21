import type { ProveedorVozEnum } from "@/generated/prisma/enums";

/**
 * 049 — Contrato interno con cualquier servicio de voz.
 *
 * El dominio nunca ve tipos, payloads ni códigos de error del proveedor
 * (Constitución, Principio IV). Un adaptador traduce y nada más: NO decide si
 * una transcripción es útil. Esa decisión —LISTO contra INAUDIBLE— es del
 * dominio y es igual para todos los proveedores, porque si cada adaptador la
 * tomara a su manera, cambiar de proveedor cambiaría el comportamiento del
 * producto.
 */
export interface IProveedorVoz {
  readonly nombre: ProveedorVozEnum;
  transcribir(params: TranscribirParams): Promise<TranscribirResult>;
  /** Verifica la credencial sin esperar a que llegue un audio real (FR-005). */
  estaDisponible(): Promise<boolean>;
}

export interface TranscribirParams {
  buffer: Buffer;
  mimeType: string;
  nombreArchivo: string;
  /**
   * ISO-639-1. Omitir = autodetección, que es lo que hacemos siempre hoy:
   * forzar el idioma del comercio degradaría la transcripción de un cliente
   * que habla en otro, justo el caso donde más se necesita leerla.
   */
  idioma?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface TranscribirResult {
  /** Texto crudo del proveedor, sin interpretar. */
  texto: string;
  idioma: string | null;
  confianzaIdioma: number | null;
  /**
   * Elementos de HABLA reconocidos. 0 significa que el audio no tenía voz
   * (ruido, música, silencio) aunque `texto` traiga algo. No es el total de
   * elementos devueltos: los proveedores mezclan marcas de espaciado y de
   * eventos sonoros con las palabras.
   */
  palabras: number;
  segundos: number | null;
  modelo: string;
  proveedor: ProveedorVozEnum;
  tiempoMs: number;
}

/**
 * Error de un proveedor de voz, ya traducido al dominio.
 *
 * `reintentable` es lo único que mira la cola. Una credencial inválida o un
 * formato no soportado no mejoran por insistir: reintentarlos cinco veces
 * gasta cinco llamadas y termina igual.
 */
export class ErrorProveedorVoz extends Error {
  constructor(
    message: string,
    readonly codigo: CodigoErrorVoz,
    readonly reintentable: boolean,
  ) {
    super(message);
    this.name = "ErrorProveedorVoz";
  }
}

export type CodigoErrorVoz =
  | "SIN_CREDENCIAL"
  | "CREDENCIAL_INVALIDA"
  | "FORMATO_NO_SOPORTADO"
  | "ARCHIVO_DEMASIADO_GRANDE"
  | "LIMITE_PROVEEDOR"
  | "TIMEOUT"
  | "RESPUESTA_INVALIDA"
  | "ERROR_PROVEEDOR";
