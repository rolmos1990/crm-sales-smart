import type { AgrupacionPreparacion, RangoPreparacion } from "@/generated/prisma/enums";

export const RANGO_PREPARACION_LABELS: Record<RangoPreparacion, string> = {
  HOY: "Hoy",
  MANANA: "Mañana",
  SEMANA: "Esta semana",
  PERSONALIZADO: "Personalizado",
};

export const AGRUPACION_PREPARACION_LABELS: Record<AgrupacionPreparacion, string> = {
  POR_PEDIDO: "Por pedido",
  POR_PRODUCTO: "Por producto",
};

/** Estados del flujo por defecto para una instancia que nunca configuró nada.
 *  Dos estados, el mínimo que el spec exige que funcione sin configuración. */
export const ESTADOS_PREPARACION_DEFECTO = [
  { nombre: "Por preparar", color: "#f59e0b", orden: 0, esInicial: true, marcaInicio: true, esFinal: false },
  { nombre: "Preparado", color: "#22c55e", orden: 1, esInicial: false, marcaInicio: false, esFinal: true },
] as const;

/** Etiqueta de la agrupación de pedidos sin fecha de entrega — nunca se
 *  ocultan por el filtro de rango (FR-019). */
export const GRUPO_SIN_FECHA = "Sin fecha";
