// 031-memoria-y-ficha-conversacion — qué sabe el agente de ESTA conversación.
//
// Dos mitades que nunca se mezclan, mismo criterio que PerfilCliente (012):
// los hechos salen de datos verificables y la lectura sale de una IA que
// puede equivocarse. Mezclarlas haría que el agente afirme como confirmado
// algo que solo fue interpretado.

import type { IntencionComercial } from "@/ai/estrategia/tipos";

/** De dónde salió un precio que el agente le informó al cliente. */
export type OrigenPrecio = "CONSULTA_PRECIO" | "BUSQUEDA" | "COTIZACION" | "PEDIDO";

export interface PrecioInformado {
  /** null cuando el monto es el total de un documento, no el precio de un producto. */
  productoId: string | null;
  nombre: string;
  monto: number;
  moneda: string;
  origen: OrigenPrecio;
  /** Mensaje en el que se le dijo el monto al cliente. */
  mensajeId: string;
  informadoEn: string; // ISO UTC
}

export interface PreguntaDelAgente {
  texto: string;
  mensajeId: string;
  hechaEn: string; // ISO UTC
  /** Turnos transcurridos desde que se hizo. No afirma que siga sin responder:
   *  decidir eso es juicio semántico y vive en `datosFaltantes` (research D7). */
  turnosDesde: number;
}

export interface DocumentoGenerado {
  tipo: "COTIZACION" | "PEDIDO";
  id: string;
  numero: string;
  total: number;
  moneda: string;
  creadoEn: string; // ISO UTC
}

export interface HechosConversacion {
  productoEnFoco: { productoId: string; nombre: string } | null;
  ultimoPrecioInformado: PrecioInformado | null;
  ultimaPreguntaDelAgente: PreguntaDelAgente | null;
  documentos: DocumentoGenerado[];
  ultimoTurnoEn: string; // ISO UTC
}

export interface LecturaConversacion {
  tema: string | null;
  intencion: IntencionComercial | null;
  datosConocidos: Record<string, string>;
  datosFaltantes: string[];
  resumen: string | null;
  confianza: number; // 0..1
  derivadoEn: string; // ISO UTC
}

export interface FichaConversacion {
  conversacionId: string;
  hechos: HechosConversacion;
  /** null hasta la primera derivación exitosa. Nunca se borra una vez que
   *  existe: si la derivación falla, se conserva la anterior (FR-023). */
  interpretado: LecturaConversacion | null;
  turnos: number;
  actualizadoEn: string; // ISO UTC
}

export const HECHOS_VACIOS: Omit<HechosConversacion, "ultimoTurnoEn"> = {
  productoEnFoco: null,
  ultimoPrecioInformado: null,
  ultimaPreguntaDelAgente: null,
  documentos: [],
};

export type { IntencionComercial };
