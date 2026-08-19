/**
 * Utilidades de fecha "aware" de zona horaria — sin librería externa, usando
 * Intl.DateTimeFormat (disponible tanto en Node como en el navegador, así
 * ambos lados calculan "hoy"/"mañana" exactamente igual).
 *
 * Por qué hace falta esto: `new Date()` y comparar campos de hora directo
 * asume la zona horaria del proceso que corre el código (el servidor, o el
 * navegador de cada usuario) — no la zona de negocio configurada en
 * ConfiguracionEmpresa.zonaHoraria. Sin esto, "Hoy" podría resolver mal cerca
 * de la medianoche, o directamente en otra fecha según dónde esté desplegado
 * el servidor o el huso horario del navegador de quien mira la pantalla.
 */

export interface FechaYMD {
  anio: number;
  mes: number; // 1-12
  dia: number;
}

/** Offset de la zona horaria respecto a UTC, en minutos, para un instante dado. */
function offsetMinutosEnZona(zonaHoraria: string, fecha: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: zonaHoraria, timeZoneName: "longOffset" });
  const parte = fmt.formatToParts(fecha).find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = parte.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const signo = match[1] === "-" ? -1 : 1;
  return signo * (Number(match[2]) * 60 + Number(match[3]));
}

/** Componentes año/mes/día de "ahora" tal como se ven en la zona horaria indicada. */
export function hoyEnZona(zonaHoraria: string, referencia: Date = new Date()): FechaYMD {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const partes = fmt.formatToParts(referencia);
  const obj: Record<string, string> = {};
  for (const p of partes) obj[p.type] = p.value;
  return { anio: Number(obj.year), mes: Number(obj.month), dia: Number(obj.day) };
}

/** Parsea un "YYYY-MM-DD" (ej. el valor de un <input type="date">) a componentes. */
export function parseYMD(valor: string): FechaYMD {
  const [anio, mes, dia] = valor.split("-").map(Number);
  return { anio, mes, dia };
}

/** Instante UTC que corresponde a las 00:00:00 de esa fecha en la zona horaria dada. */
export function inicioDiaEnZona({ anio, mes, dia }: FechaYMD, zonaHoraria: string): Date {
  const aproximado = new Date(Date.UTC(anio, mes - 1, dia, 0, 0, 0));
  const offset = offsetMinutosEnZona(zonaHoraria, aproximado);
  return new Date(aproximado.getTime() - offset * 60_000);
}

export function sumarDias({ anio, mes, dia }: FechaYMD, dias: number): FechaYMD {
  // Delegar en el motor de fechas de JS (maneja fin de mes/año correctamente)
  // usando UTC puro — acá solo se manipulan componentes de calendario, no
  // instantes reales, así que no hay ninguna zona horaria involucrada todavía.
  const d = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

/**
 * Rango [desde, hasta) de un día completo, offset días desde hoy, en la zona
 * horaria de negocio. offsetDias=0 → hoy, offsetDias=1 → mañana.
 */
export function rangoDiaEnZona(zonaHoraria: string, offsetDias: number, referencia: Date = new Date()): { desde: Date; hasta: Date } {
  const base = sumarDias(hoyEnZona(zonaHoraria, referencia), offsetDias);
  const desde = inicioDiaEnZona(base, zonaHoraria);
  const hasta = inicioDiaEnZona(sumarDias(base, 1), zonaHoraria);
  return { desde, hasta };
}

/**
 * Rango [primer día del mes actual 00:00, ahora] en la zona horaria de
 * negocio — usado para "Total ventas · mes actual". El límite superior es
 * el instante actual, no el fin del mes (todavía no pasó).
 */
export function rangoMesActualEnZona(zonaHoraria: string, referencia: Date = new Date()): { desde: Date; hasta: Date } {
  const { anio, mes } = hoyEnZona(zonaHoraria, referencia);
  const desde = inicioDiaEnZona({ anio, mes, dia: 1 }, zonaHoraria);
  return { desde, hasta: referencia };
}

/** "YYYY-MM-DD" de una fecha, tal como se ve en la zona horaria dada — para
 *  comparar dos fechas por día calendario sin que la hora/TZ interfiera. */
export function fechaYMDEnZona(fecha: Date, zonaHoraria: string): string {
  const { anio, mes, dia } = hoyEnZona(zonaHoraria, fecha);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "Agosto 2026" a partir de una fecha, en la zona horaria dada. */
export function etiquetaMesAnioEnZona(fecha: Date, zonaHoraria: string): string {
  const { anio, mes } = hoyEnZona(zonaHoraria, fecha);
  const nombre = MESES_ES[mes - 1];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}
