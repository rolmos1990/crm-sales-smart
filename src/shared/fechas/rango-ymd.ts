/**
 * Lógica pura del filtro de rango de fechas — el par "YYYY-MM-DD" que viaja en
 * la URL (`?desde/?hasta`, `?entregaDesde/?entregaHasta`, …) y que
 * `parsearExtremosDeSearchParams` resuelve después a instantes UTC en la zona
 * de negocio.
 *
 * Vive separado del componente (`components/filtro-rango-fechas.tsx`) para que
 * sea testeable sin React ni DOM: la suite unitaria solo mira `*.test.ts`.
 *
 * Acá **no hay instantes**: son días de calendario. El único punto donde se
 * construye un `Date` real es para formatear, y se hace ida y vuelta con la
 * misma zona para que no haya corrimiento.
 */

import { formatearFechaCorta, formatearRangoFechasCorto, type PreferenciasFecha } from "./formato";
import { desdeFechaCalendario, parseYMD } from "./zona";
import type { FechaYMD } from "./tipos";

export interface RangoFechasYmd {
  /** "YYYY-MM-DD" o null. Día de calendario, no instante. */
  desde: string | null;
  hasta: string | null;
}

export const RANGO_YMD_VACIO: RangoFechasYmd = { desde: null, hasta: null };

export function ymdAString({ anio, mes, dia }: FechaYMD): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * "YYYY-MM-DD" → `Date` de medianoche **local del navegador**.
 *
 * Es el único marco que entiende react-day-picker, que lee `getFullYear` /
 * `getMonth` / `getDate`. No es un instante de negocio: solo sirve para pintar
 * la grilla del calendario, y lo que sale de ahí vuelve a ser "YYYY-MM-DD" vía
 * `deDiaDeCalendario`.
 */
export function aDiaDeCalendario(ymd: string): Date {
  const { anio, mes, dia } = parseYMD(ymd);
  return new Date(anio, mes - 1, dia);
}

/** Inversa de `aDiaDeCalendario`. Nunca `toISOString()`, que lee el día en UTC. */
export function deDiaDeCalendario(d: Date): string {
  return ymdAString({ anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() });
}

/** Días de calendario que abarca el rango, ambos extremos incluidos. */
export function diasDelRango(desde: string, hasta: string): number {
  const a = parseYMD(desde);
  const b = parseYMD(hasta);
  // UTC puro: solo se restan componentes de calendario, así que ningún cambio
  // de horario de verano puede meter un ±1 hora que redondee mal.
  const ms = Date.UTC(b.anio, b.mes - 1, b.dia) - Date.UTC(a.anio, a.mes - 1, a.dia);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * Cierra el rango a partir del extremo ya elegido y del día recién clickeado,
 * ordenándolos. Clickear dos veces el mismo día da un rango de un solo día —
 * que es justo lo que `addToRange` de react-day-picker interpreta como
 * "deseleccionar todo".
 */
export function cerrarRango(inicio: string | null, diaClickeado: string): RangoFechasYmd {
  const a = inicio ?? diaClickeado;
  // Comparación lexicográfica: "YYYY-MM-DD" ordena igual que cronológicamente.
  return diaClickeado < a ? { desde: diaClickeado, hasta: a } : { desde: a, hasta: diaClickeado };
}

/**
 * Etiqueta del trigger: "12 sep – 18 sep 2026", "12 sep 2026" para un solo
 * día, o "Desde …" / "Hasta …" cuando el rango quedó abierto de un lado.
 *
 * El "YYYY-MM-DD" se reconstituye como instante en la **misma** zona con la
 * que después se formatea, así que el viaje de ida y vuelta devuelve
 * exactamente el día que el usuario eligió. Es la forma de reusar los
 * formateadores del proyecto (que trabajan sobre instantes) sin introducir un
 * corrimiento.
 */
export function etiquetaRangoFechas(
  valor: RangoFechasYmd,
  p: PreferenciasFecha,
  placeholder: string,
): string {
  const aInstante = (ymd: string) => desdeFechaCalendario(ymd, p.zonaHoraria);
  if (valor.desde && valor.hasta) {
    return formatearRangoFechasCorto(aInstante(valor.desde), aInstante(valor.hasta), p);
  }
  if (valor.desde) return `Desde ${formatearFechaCorta(aInstante(valor.desde), p)}`;
  if (valor.hasta) return `Hasta ${formatearFechaCorta(aInstante(valor.hasta), p)}`;
  return placeholder;
}
