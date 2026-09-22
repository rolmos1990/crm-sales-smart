/**
 * Formateo de fechas para presentación — punto único.
 *
 * Se usa `Intl.DateTimeFormat` con `timeZone` explícito, no `date-fns`: el
 * `format` de date-fns v4 no acepta zona horaria, así que siempre renderiza en
 * la zona del proceso (el servidor) o del navegador. Hacerlo TZ-aware exigiría
 * `@date-fns/tz`, una dependencia nueva que no hace falta. `date-fns` se
 * conserva para aritmética sobre `Date` ya correctos.
 */

import { diasDeDiferenciaEnZona } from "./zona";

export type FormatoFecha = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type FormatoHora = "12h" | "24h";

export interface PreferenciasFecha {
  /** Zona con la que se renderiza. Presentación, no cálculo de negocio. */
  zonaHoraria: string;
  locale: string;
  formatoFecha: FormatoFecha;
  formatoHora: FormatoHora;
}

export const LOCALE_DEFAULT = "es-PE";

export const PREFERENCIAS_FECHA_DEFAULT: PreferenciasFecha = {
  zonaHoraria: "UTC",
  locale: LOCALE_DEFAULT,
  formatoFecha: "DD/MM/YYYY",
  formatoHora: "24h",
};

export function esFormatoFecha(v: unknown): v is FormatoFecha {
  return v === "DD/MM/YYYY" || v === "MM/DD/YYYY" || v === "YYYY-MM-DD";
}

export function esFormatoHora(v: unknown): v is FormatoHora {
  return v === "12h" || v === "24h";
}

// ── Caché de formateadores ──────────────────────────────────────────────────
//
// Construir un Intl.DateTimeFormat es la parte cara, y acá se formatea dentro
// de filas de tabla. Se memoizan por (locale, zona, opciones).

const cacheFormateadores = new Map<string, Intl.DateTimeFormat>();

function formateador(locale: string, zonaHoraria: string, opciones: Intl.DateTimeFormatOptions) {
  const clave = `${locale}|${zonaHoraria}|${JSON.stringify(opciones)}`;
  let fmt = cacheFormateadores.get(clave);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { ...opciones, timeZone: zonaHoraria });
    cacheFormateadores.set(clave, fmt);
  }
  return fmt;
}

function normalizar(valor: Date | string | number | null | undefined): Date | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function opcionesHora(formatoHora: FormatoHora): Intl.DateTimeFormatOptions {
  // hourCycle h23 evita que la medianoche salga como "24:00" en algunos locales.
  return formatoHora === "24h"
    ? { hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23" }
    : { hour: "numeric", minute: "2-digit", hour12: true };
}

/**
 * Reensambla día/mes/año en el orden pedido.
 *
 * Hace falta porque `Intl` ordena las partes según el locale, no según la
 * preferencia del tenant: con `es-PE` siempre daría 17/09/2026 aunque la
 * empresa haya configurado MM/DD/YYYY.
 */
function ensamblarPorPatron(partes: Intl.DateTimeFormatPart[], formato: FormatoFecha): string {
  const p: Record<string, string> = {};
  for (const parte of partes) p[parte.type] = parte.value;
  switch (formato) {
    case "MM/DD/YYYY": return `${p.month}/${p.day}/${p.year}`;
    case "YYYY-MM-DD": return `${p.year}-${p.month}-${p.day}`;
    default:           return `${p.day}/${p.month}/${p.year}`;
  }
}

const OPCIONES_NUMERICAS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};

// ── API pública ─────────────────────────────────────────────────────────────

/** Fecha numérica según `formatoFecha` de la empresa. Ej. "17/09/2026". */
export function formatearFecha(valor: Date | string | number | null | undefined, p: PreferenciasFecha): string {
  const d = normalizar(valor);
  if (!d) return "";
  const partes = formateador(p.locale, p.zonaHoraria, OPCIONES_NUMERICAS).formatToParts(d);
  return ensamblarPorPatron(partes, p.formatoFecha);
}

/** Fecha + hora. Ej. "17/09/2026 · 21:30". */
export function formatearFechaHora(valor: Date | string | number | null | undefined, p: PreferenciasFecha): string {
  const d = normalizar(valor);
  if (!d) return "";
  return `${formatearFecha(d, p)} · ${formatearHora(d, p)}`;
}

/** Solo la hora, según `formatoHora` de la empresa. */
export function formatearHora(valor: Date | string | number | null | undefined, p: PreferenciasFecha): string {
  const d = normalizar(valor);
  if (!d) return "";
  return formateador(p.locale, p.zonaHoraria, opcionesHora(p.formatoHora)).format(d);
}

/** "17 de septiembre de 2026" — orden del locale, que es el correcto acá. */
export function formatearFechaLarga(valor: Date | string | number | null | undefined, p: PreferenciasFecha): string {
  const d = normalizar(valor);
  if (!d) return "";
  return formateador(p.locale, p.zonaHoraria, { day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** "17 sep 2026" — el equivalente al viejo `format(d, "dd MMM yyyy")`. */
export function formatearFechaCorta(valor: Date | string | number | null | undefined, p: PreferenciasFecha): string {
  const d = normalizar(valor);
  if (!d) return "";
  return formateador(p.locale, p.zonaHoraria, { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

const cacheRelativo = new Map<string, Intl.RelativeTimeFormat>();

/**
 * "hoy" / "ayer" / "hace 3 días" / "en 2 meses".
 *
 * Agrupa por **día calendario en la zona dada**, no por milisegundos: un
 * `Math.floor(delta / 86400000)` se equivoca cuando las horas del día difieren
 * y además ignora que un día con cambio de horario dura 23 o 25 horas.
 */
export function formatearFechaRelativa(
  valor: Date | string | number | null | undefined,
  p: PreferenciasFecha,
  referencia: Date = new Date(),
): string {
  const d = normalizar(valor);
  if (!d) return "";

  let rtf = cacheRelativo.get(p.locale);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(p.locale, { numeric: "auto" });
    cacheRelativo.set(p.locale, rtf);
  }

  const dias = diasDeDiferenciaEnZona(d, referencia, p.zonaHoraria);
  if (Math.abs(dias) < 1) return rtf.format(0, "day");   // "hoy"
  if (Math.abs(dias) < 7) return rtf.format(dias, "day");
  if (Math.abs(dias) < 30) return rtf.format(Math.trunc(dias / 7), "week");
  if (Math.abs(dias) < 365) return rtf.format(Math.trunc(dias / 30), "month");
  return rtf.format(Math.trunc(dias / 365), "year");
}

/**
 * Rango de dos fechas colapsando las partes repetidas: "12 sep – 18 sep 2026",
 * "28 sep – 03 oct 2026", y un solo día como "12 sep 2026".
 *
 * Se usa `Intl.DateTimeFormat.formatRange`, que sabe qué partes comparten las
 * dos fechas según el locale — concatenar dos `formatearFechaCorta` con un
 * guion repetiría el año en el 99% de los rangos, que es justo lo que hace
 * ilegible una barra de filtros.
 *
 * Ojo: `formatRange` con dos fechas del mismo día devuelve el día repetido en
 * algunos runtimes, así que ese caso se atiende antes de llegar a ICU.
 */
export function formatearRangoFechasCorto(
  inicio: Date | string | number | null | undefined,
  fin: Date | string | number | null | undefined,
  p: PreferenciasFecha,
): string {
  const a = normalizar(inicio);
  const b = normalizar(fin);
  if (!a && !b) return "";
  if (!a) return formatearFechaCorta(b, p);
  if (!b) return formatearFechaCorta(a, p);

  const fmt = formateador(p.locale, p.zonaHoraria, { day: "2-digit", month: "short", year: "numeric" });
  if (fmt.format(a) === fmt.format(b)) return fmt.format(a);
  return fmt.formatRange(a, b);
}
