import type { PesosCriterio } from "./criterio/schema";

/**
 * 042 — Puntaje comercial (research D7). Puro.
 *
 * base (0–60): suma ponderada de factores objetivos normalizados a [0, 1].
 * ajuste de la IA (−40…+40): lo que la conversación agrega o resta.
 * final = clamp(base + ajuste, 0, 100). Sin IA, el puntaje es la base.
 *
 * El techo de 60 para la base es deliberado: un contacto solo llega a "muy
 * caliente" si además hay señales en la conversación.
 */

export const PUNTAJE_BASE_MAXIMO = 60;
export const AJUSTE_IA_MAXIMO = 40;

export interface FactoresPuntaje {
  compras: number;
  recencia: number;
  documentosAbiertos: number;
  actividadAgendada: number;
  esperaRespuesta: number;
}

const acotar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function calcularPuntajeBase(factores: FactoresPuntaje, pesos: PesosCriterio): number {
  const suma =
    pesos.compras * acotar(factores.compras, 0, 1) +
    pesos.recencia * acotar(factores.recencia, 0, 1) +
    pesos.documentosAbiertos * acotar(factores.documentosAbiertos, 0, 1) +
    pesos.actividadAgendada * acotar(factores.actividadAgendada, 0, 1) +
    pesos.esperaRespuesta * acotar(factores.esperaRespuesta, 0, 1);
  return Math.round(acotar(suma, 0, 1) * PUNTAJE_BASE_MAXIMO);
}

export function acotarAjusteIA(ajuste: number): number {
  return Math.round(acotar(ajuste, -AJUSTE_IA_MAXIMO, AJUSTE_IA_MAXIMO));
}

export function combinarPuntaje(base: number, ajusteIA: number | null): number {
  return Math.round(acotar(base + (ajusteIA === null ? 0 : acotarAjusteIA(ajusteIA)), 0, 100));
}
