/**
 * Rangos de fechas resueltos en la zona de negocio, listos para un `where` de
 * Prisma.
 *
 * Invariantes que sostienen todo el módulo:
 *
 *  1. Todos los rangos son **semiabiertos**: [desde, hasta). Nunca `lte` sobre
 *     un límite de día. Un `endOfDay()` devuelve .999 y pierde las filas
 *     escritas en .9995 de una columna `timestamp(3)`.
 *  2. El filtro se aplica **sobre la columna cruda**, comparándola con dos
 *     instantes UTC ya calculados. Nunca `AT TIME ZONE` ni `DATE_TRUNC` sobre
 *     la columna: eso impide usar el índice.
 *  3. La zona llega siempre como parámetro explícito. Estas funciones no
 *     resuelven la zona por su cuenta porque también corren en el worker.
 */

import { hoyEnZona, inicioDiaEnZona, parseYMD, sumarDias } from "./zona";
import type { RangoUtc } from "./tipos";

export type { RangoUtc } from "./tipos";

/** Hoy completo, en la zona de negocio. */
export function rangoHoy(zonaHoraria: string, referencia: Date = new Date()): RangoUtc {
  return rangoDesdeOffset(zonaHoraria, 0, referencia);
}

export function rangoAyer(zonaHoraria: string, referencia: Date = new Date()): RangoUtc {
  return rangoDesdeOffset(zonaHoraria, -1, referencia);
}

export function rangoManana(zonaHoraria: string, referencia: Date = new Date()): RangoUtc {
  return rangoDesdeOffset(zonaHoraria, 1, referencia);
}

function rangoDesdeOffset(zonaHoraria: string, offsetDias: number, referencia: Date): RangoUtc {
  const base = sumarDias(hoyEnZona(zonaHoraria, referencia), offsetDias);
  return {
    desde: inicioDiaEnZona(base, zonaHoraria),
    hasta: inicioDiaEnZona(sumarDias(base, 1), zonaHoraria),
  };
}

/**
 * Los últimos `n` días incluyendo hoy: [inicio de hace n-1 días, inicio de mañana).
 * `rangoUltimosDias(tz, 1)` es exactamente `rangoHoy(tz)`.
 */
export function rangoUltimosDias(zonaHoraria: string, n: number, referencia: Date = new Date()): RangoUtc {
  const hoy = hoyEnZona(zonaHoraria, referencia);
  return {
    desde: inicioDiaEnZona(sumarDias(hoy, -(n - 1)), zonaHoraria),
    hasta: inicioDiaEnZona(sumarDias(hoy, 1), zonaHoraria),
  };
}

/**
 * La semana **calendario** que contiene hoy, de lunes a domingo.
 *
 * Distinta de `rangoSemanaEnZona` (src/sales/preparacion/utils/rangos.ts), que
 * significa "los próximos 7 días incluyendo hoy" y de la que depende el
 * tablero de preparación. Son dos conceptos, no un duplicado.
 */
export function rangoEstaSemana(zonaHoraria: string, referencia: Date = new Date()): RangoUtc {
  const hoy = hoyEnZona(zonaHoraria, referencia);
  // getUTCDay() sobre los componentes de calendario: 0=domingo. Se convierte a
  // una semana que empieza el lunes.
  const diaSemana = new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia)).getUTCDay();
  const desdeElLunes = (diaSemana + 6) % 7;
  const lunes = sumarDias(hoy, -desdeElLunes);
  return {
    desde: inicioDiaEnZona(lunes, zonaHoraria),
    hasta: inicioDiaEnZona(sumarDias(lunes, 7), zonaHoraria),
  };
}

/** El mes calendario completo que contiene hoy. */
export function rangoEsteMes(zonaHoraria: string, referencia: Date = new Date()): RangoUtc {
  const { anio, mes } = hoyEnZona(zonaHoraria, referencia);
  return {
    desde: inicioDiaEnZona({ anio, mes, dia: 1 }, zonaHoraria),
    hasta: inicioDiaEnZona(mes === 12 ? { anio: anio + 1, mes: 1, dia: 1 } : { anio, mes: mes + 1, dia: 1 }, zonaHoraria),
  };
}

/**
 * Del día 1 del mes actual hasta ahora — no hasta el fin del mes, que todavía
 * no pasó. Es el criterio de "Total ventas · mes actual".
 */
export function rangoMesHastaAhora(zonaHoraria: string, referencia: Date = new Date()): RangoUtc {
  const { anio, mes } = hoyEnZona(zonaHoraria, referencia);
  return { desde: inicioDiaEnZona({ anio, mes, dia: 1 }, zonaHoraria), hasta: referencia };
}

/**
 * Un par desde/hasta en formato "YYYY-MM-DD" (lo que mandan los filtros de la
 * UI) convertido al rango UTC equivalente.
 *
 * `hasta` es **inclusivo por día**: pedir 17→17 devuelve el 17 completo. Se
 * logra tomando el inicio del día siguiente como límite superior exclusivo.
 * Devuelve `null` si no hay ninguno de los dos, para poder omitir el filtro.
 */
export function rangoEntreFechas(
  desdeYmd: string | undefined | null,
  hastaYmd: string | undefined | null,
  zonaHoraria: string,
): RangoUtc | null {
  if (!desdeYmd && !hastaYmd) return null;
  return {
    desde: desdeYmd ? inicioDiaEnZona(parseYMD(desdeYmd), zonaHoraria) : new Date(-8_640_000_000_000_000),
    hasta: hastaYmd
      ? inicioDiaEnZona(sumarDias(parseYMD(hastaYmd), 1), zonaHoraria)
      : new Date(8_640_000_000_000_000),
  };
}

/** Rango → filtro Prisma semiabierto. `undefined` cuando no hay rango. */
export function aFiltroPrisma(rango: RangoUtc | null | undefined): { gte: Date; lt: Date } | undefined {
  if (!rango) return undefined;
  return { gte: rango.desde, lt: rango.hasta };
}
