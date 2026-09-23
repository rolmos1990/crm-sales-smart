import "server-only";

import { parsearExtremosDeSearchParams } from "@/shared/fechas/searchparams";
import { LIMITE_POR_ESTADO, obtenerResumenPorProducto, obtenerTableroPreparacion } from "./queries";
import type { FiltrosTableroInput, FiltrosVistaPreparacion } from "./schema";
import type { ResumenProducto, Tablero } from "./types";

export interface VistaPreparacion {
  tablero: Tablero;
  resumen: ResumenProducto[];
}

/**
 * Traduce los filtros de la barra a las consultas del tablero. Lo usan la
 * página (filtros por defecto, primer render) y la Server Action que consulta
 * la barra al cambiar un filtro.
 */
export async function cargarVistaPreparacion(
  instanciaId: string,
  zonaHoraria: string,
  f: FiltrosVistaPreparacion,
): Promise<VistaPreparacion> {
  // `hasta` es inclusivo por día, igual que en Pedidos: `resolverRango` lo usa
  // como límite exclusivo, así que el parser ya lo corre al día siguiente.
  const { desde, hasta } = f.rango === "PERSONALIZADO"
    ? parsearExtremosDeSearchParams({ desde: f.desde ?? undefined, hasta: f.hasta ?? undefined }, zonaHoraria)
    : { desde: undefined, hasta: undefined };

  const filtros: FiltrosTableroInput = { rango: f.rango, desde, hasta, busqueda: f.q || undefined };
  const limitesPorEstado = new Map(Object.entries(f.limites));

  const [tablero, resumen] = await Promise.all([
    obtenerTableroPreparacion(instanciaId, zonaHoraria, filtros, LIMITE_POR_ESTADO, limitesPorEstado),
    obtenerResumenPorProducto(instanciaId, zonaHoraria, filtros),
  ]);
  return { tablero, resumen };
}
