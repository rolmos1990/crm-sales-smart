/**
 * Conversión de los filtros de fecha que llegan por query param a rangos UTC.
 *
 * Los filtros viajan como "YYYY-MM-DD" (fecha de calendario, sin hora) — así
 * está documentado en `src/crm/pipeline/schema.ts`. Interpretarlos con
 * `new Date("2026-09-17T00:00:00")` los resuelve en la zona del **proceso
 * servidor**, que es de donde salían los corrimientos de un día. Acá se
 * interpretan siempre en la zona de negocio.
 *
 * Los prefijos siguen la convención que ya usan las URLs de la app:
 *   ""         → ?desde / ?hasta
 *   "entrega"  → ?entregaDesde / ?entregaHasta
 *   "creado"   → ?creadoDesde / ?creadoHasta
 *   "cierre"   → ?cierreDesde / ?cierreHasta
 *   "venc"     → ?vencDesde / ?vencHasta
 */

import { rangoEntreFechas } from "./rangos";
import type { RangoUtc } from "./tipos";

export type SearchParamsPlanos = Record<string, string | string[] | undefined>;

function leer(sp: SearchParamsPlanos, clave: string): string | undefined {
  const v = sp[clave];
  const valor = Array.isArray(v) ? v[0] : v;
  return valor && valor.trim() !== "" ? valor : undefined;
}

/** Nombres de los dos params según el prefijo. `""` → `desde`/`hasta`. */
export function clavesRango(prefijo = ""): { desde: string; hasta: string } {
  return prefijo
    ? { desde: `${prefijo}Desde`, hasta: `${prefijo}Hasta` }
    : { desde: "desde", hasta: "hasta" };
}

/**
 * Rango UTC a partir del par desde/hasta de la URL. `null` si no vino ninguno,
 * para poder omitir el filtro por completo.
 *
 * `hasta` es inclusivo por día: pedir 17→17 devuelve el 17 entero.
 */
export function parsearRangoDeSearchParams(
  sp: SearchParamsPlanos,
  zonaHoraria: string,
  opciones: { prefijo?: string } = {},
): RangoUtc | null {
  const claves = clavesRango(opciones.prefijo);
  return rangoEntreFechas(leer(sp, claves.desde), leer(sp, claves.hasta), zonaHoraria);
}

/**
 * Variante que devuelve los dos extremos por separado, con `undefined` cuando
 * el usuario no acotó ese lado.
 *
 * Es lo que necesitan los filtros que construyen un `where` parcial
 * (`{ gte }` sin `lt`, o al revés) en vez de un rango cerrado.
 */
export function parsearExtremosDeSearchParams(
  sp: SearchParamsPlanos,
  zonaHoraria: string,
  opciones: { prefijo?: string } = {},
): { desde?: Date; hasta?: Date } {
  const claves = clavesRango(opciones.prefijo);
  const desdeYmd = leer(sp, claves.desde);
  const hastaYmd = leer(sp, claves.hasta);
  if (!desdeYmd && !hastaYmd) return {};

  const rango = rangoEntreFechas(desdeYmd, hastaYmd, zonaHoraria)!;
  return {
    desde: desdeYmd ? rango.desde : undefined,
    hasta: hastaYmd ? rango.hasta : undefined,
  };
}
