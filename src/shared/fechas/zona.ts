/**
 * Kernel de fechas "aware" de zona horaria — sin librería externa, usando
 * Intl.DateTimeFormat (disponible tanto en Node como en el navegador, así
 * ambos lados calculan "hoy"/"mañana" exactamente igual).
 *
 * Por qué hace falta esto: `new Date()` y comparar campos de hora directo
 * asume la zona horaria del proceso que corre el código (el servidor, o el
 * navegador de cada usuario) — no la zona de negocio configurada en
 * ConfiguracionEmpresa.zonaHoraria. Sin esto, "Hoy" podría resolver mal cerca
 * de la medianoche, o directamente en otra fecha según dónde esté desplegado
 * el servidor o el huso horario del navegador de quien mira la pantalla.
 *
 * Este módulo es isomorfo y sin dependencias a propósito: lo importan Server
 * Components, Client Components y el worker standalone (`tsx`, fuera de
 * Next.js). No importar acá `next/*`, Prisma, ni nada con efectos.
 */

import type { FechaCalendario, FechaHoraLocal, FechaYMD } from "./tipos";

export type { FechaYMD } from "./tipos";

/** Último recurso cuando no hay ninguna zona resoluble. */
export const ZONA_FALLBACK = "UTC";

/**
 * Zona de negocio por defecto cuando la instancia no tiene configuración o la
 * guardada es inválida. Vive acá (módulo isomorfo, sin Prisma) para que
 * también puedan usarla los Client Components — `negocio.ts` la reexporta.
 */
export const ZONA_NEGOCIO_FALLBACK = "America/Lima";

// ── Validación ──────────────────────────────────────────────────────────────

// Se valida antes de pasar la cadena a ICU: `Intl` lanza RangeError con una
// zona inválida, y la zona puede venir de una cookie que escribe el cliente.
const FORMA_ZONA = /^[A-Za-z0-9_+\-/]{1,64}$/;

const cacheValidez = new Map<string, boolean>();

/**
 * ¿Es un identificador IANA que Intl acepta?
 *
 * Deliberadamente NO se usa `Intl.supportedValuesOf("timeZone")`: esa lista no
 * incluye "UTC" aunque `Intl.DateTimeFormat` sí lo acepta. El try/catch es la
 * única comprobación fiel — acepta "UTC" y "America/Panama", y rechaza los
 * offsets fijos tipo "UTC-5", que es justo lo que no queremos (no contemplan
 * el horario de verano).
 */
export function esZonaHorariaValida(zona: string | null | undefined): zona is string {
  if (!zona || !FORMA_ZONA.test(zona)) return false;
  const cacheado = cacheValidez.get(zona);
  if (cacheado !== undefined) return cacheado;
  let valida = true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zona });
  } catch {
    valida = false;
  }
  cacheValidez.set(zona, valida);
  return valida;
}

// ── Offset ──────────────────────────────────────────────────────────────────

/**
 * Offset de la zona horaria respecto a UTC, en minutos, para un instante dado.
 *
 * Se usa `longOffset` (no `short`, que devuelve abreviaturas como "PET"). Para
 * `timeZone: "UTC"` Intl devuelve el literal "GMT", el match falla y se
 * devuelve 0 — que es el valor correcto.
 */
export function offsetMinutosEnZona(zonaHoraria: string, fecha: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: zonaHoraria, timeZoneName: "longOffset" });
  const parte = fmt.formatToParts(fecha).find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = parte.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const signo = match[1] === "-" ? -1 : 1;
  return signo * (Number(match[2]) * 60 + Number(match[3]));
}

// ── Componentes de calendario ───────────────────────────────────────────────

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

function formatearYMD({ anio, mes, dia }: FechaYMD): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function sumarDias({ anio, mes, dia }: FechaYMD, dias: number): FechaYMD {
  // Delegar en el motor de fechas de JS (maneja fin de mes/año correctamente)
  // usando UTC puro — acá solo se manipulan componentes de calendario, no
  // instantes reales, así que no hay ninguna zona horaria involucrada todavía.
  const d = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

// ── Hora de pared → instante ────────────────────────────────────────────────

/**
 * Instante UTC que corresponde a una hora de pared concreta en una zona.
 *
 * Dos pasadas, no una: el offset se mide primero en un instante aproximado, y
 * si al aplicarlo caemos en una zona con otro offset (el día de un cambio de
 * horario) hay que volver a medir. Con una sola pasada, en `America/Santiago`
 * el 2026-04-05 la medianoche resolvía a las 23:00 del día anterior.
 *
 * Los dos bordes del horario de verano:
 *  - Hora inexistente (salto hacia adelante — Santiago pasa de 00:00 a 01:00):
 *    se devuelve el primer instante real del día, nunca el día anterior.
 *  - Hora ambigua (salto hacia atrás, ocurre dos veces): se devuelve la
 *    primera, que es la que espera quien mira un calendario.
 */
function instanteDeParedEnZona(
  { anio, mes, dia }: FechaYMD,
  hora: number,
  minuto: number,
  zonaHoraria: string,
): Date {
  const aprox = Date.UTC(anio, mes - 1, dia, hora, minuto, 0);
  const offset1 = offsetMinutosEnZona(zonaHoraria, new Date(aprox));
  let resultado = new Date(aprox - offset1 * 60_000);

  const offset2 = offsetMinutosEnZona(zonaHoraria, resultado);
  if (offset2 !== offset1) resultado = new Date(aprox - offset2 * 60_000);

  // Si la hora de pared pedida no existe ese día, la corrección nos deja en el
  // día anterior. Avanzar al primer instante que sí pertenece al día pedido.
  if (fechaYMDEnZona(resultado, zonaHoraria) !== formatearYMD({ anio, mes, dia })) {
    resultado = new Date(resultado.getTime() + 3_600_000);
  }
  return resultado;
}

/** Instante UTC que corresponde a las 00:00:00 de esa fecha en la zona horaria dada. */
export function inicioDiaEnZona(ymd: FechaYMD, zonaHoraria: string): Date {
  return instanteDeParedEnZona(ymd, 0, 0, zonaHoraria);
}

// ── Rangos de día/mes ───────────────────────────────────────────────────────

/**
 * Rango [desde, hasta) de un día completo, offset días desde hoy, en la zona
 * horaria de negocio. offsetDias=0 → hoy, offsetDias=1 → mañana.
 */
export function rangoDiaEnZona(
  zonaHoraria: string,
  offsetDias: number,
  referencia: Date = new Date(),
): { desde: Date; hasta: Date } {
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
export function rangoMesActualEnZona(
  zonaHoraria: string,
  referencia: Date = new Date(),
): { desde: Date; hasta: Date } {
  const { anio, mes } = hoyEnZona(zonaHoraria, referencia);
  const desde = inicioDiaEnZona({ anio, mes, dia: 1 }, zonaHoraria);
  return { desde, hasta: referencia };
}

// ── Conversiones de borde ───────────────────────────────────────────────────

/** "YYYY-MM-DD" de una fecha, tal como se ve en la zona horaria dada — para
 *  comparar dos fechas por día calendario sin que la hora/TZ interfiera. */
export function fechaYMDEnZona(fecha: Date, zonaHoraria: string): string {
  return formatearYMD(hoyEnZona(zonaHoraria, fecha));
}

/**
 * Instante → fecha de calendario, leída en la zona dada.
 *
 * Esto es lo que reemplaza a `.toISOString().slice(0, 10)`, que lee el día en
 * UTC y por eso devuelve el día siguiente para cualquier instante de la tarde
 * en América.
 */
export function aFechaCalendario(fecha: Date, zonaHoraria: string): FechaCalendario {
  return fechaYMDEnZona(fecha, zonaHoraria) as FechaCalendario;
}

/** Fecha de calendario → el instante de su medianoche local en la zona dada. */
export function desdeFechaCalendario(ymd: string, zonaHoraria: string): Date {
  return inicioDiaEnZona(parseYMD(ymd), zonaHoraria);
}

/**
 * Instante → "YYYY-MM-DDTHH:mm" para un `<input type="datetime-local">`.
 *
 * Par simétrico de `aInstante`. Usar `.toISOString().slice(0, 16)` acá es el
 * bug que desplaza la hora guardada en cada edición: pinta el reloj UTC en un
 * control que el navegador vuelve a leer como hora local.
 */
export function aFechaHoraLocal(fecha: Date, zonaHoraria: string): FechaHoraLocal {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const obj: Record<string, string> = {};
  for (const p of fmt.formatToParts(fecha)) obj[p.type] = p.value;
  return `${obj.year}-${obj.month}-${obj.day}T${obj.hour}:${obj.minute}` as FechaHoraLocal;
}

/** "YYYY-MM-DDTHH:mm" interpretado en la zona dada → instante UTC. */
export function aInstante(local: string, zonaHoraria: string): Date {
  const [fecha, hora = "00:00"] = local.split("T");
  const [h, m] = hora.split(":").map(Number);
  return instanteDeParedEnZona(parseYMD(fecha), h || 0, m || 0, zonaHoraria);
}

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parsea un valor de fecha proveniente de una importación (CSV/XLSX), donde no
 * se controla el formato de entrada.
 *
 * Un "2026-09-17" pelado es una **fecha de calendario**: `new Date()` lo
 * interpreta como medianoche UTC, que es el día anterior en toda América. Acá
 * se interpreta como medianoche en la zona de negocio. Cualquier otro formato
 * (ISO con hora, con offset) ya representa un instante y se respeta tal cual.
 *
 * Devuelve `null` si el valor está vacío o no es parseable, para no guardar
 * "Invalid Date".
 */
export function parsearFechaImportada(valor: unknown, zonaHoraria: string): Date | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;

  const texto = String(valor).trim();
  if (!texto) return null;
  if (SOLO_FECHA.test(texto)) return desdeFechaCalendario(texto, zonaHoraria);

  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Hora de pared (0-23) y minuto de un instante, en la zona dada. */
export function horaEnZona(fecha: Date, zonaHoraria: string): { hora: number; minuto: number } {
  const [, hm] = aFechaHoraLocal(fecha, zonaHoraria).split("T");
  const [hora, minuto] = hm.split(":").map(Number);
  return { hora, minuto };
}

// ── Comparaciones por día calendario ────────────────────────────────────────
//
// Todas evitan `Math.floor((a - b) / 86400000)`: esa cuenta ignora que un día
// con cambio de horario dura 23 o 25 horas, y compara instantes en vez de días.

const MS_POR_DIA = 86_400_000;

/**
 * Días calendario de diferencia entre dos instantes, en la zona dada.
 * Positivo si `a` es posterior a `b`.
 */
export function diasDeDiferenciaEnZona(a: Date, b: Date, zonaHoraria: string): number {
  // Se comparan las medianoches locales llevadas a UTC: al ser ambas el mismo
  // punto del día, la división entera por 24 h es exacta aunque en el medio
  // haya un cambio de horario.
  const inicioA = Date.UTC(...ymdTupla(hoyEnZona(zonaHoraria, a)));
  const inicioB = Date.UTC(...ymdTupla(hoyEnZona(zonaHoraria, b)));
  return Math.round((inicioA - inicioB) / MS_POR_DIA);
}

function ymdTupla({ anio, mes, dia }: FechaYMD): [number, number, number] {
  return [anio, mes - 1, dia];
}

export function esMismoDiaEnZona(a: Date, b: Date, zonaHoraria: string): boolean {
  return fechaYMDEnZona(a, zonaHoraria) === fechaYMDEnZona(b, zonaHoraria);
}

export function esHoyEnZona(fecha: Date, zonaHoraria: string, referencia: Date = new Date()): boolean {
  return esMismoDiaEnZona(fecha, referencia, zonaHoraria);
}

export function esMananaEnZona(fecha: Date, zonaHoraria: string, referencia: Date = new Date()): boolean {
  return diasDeDiferenciaEnZona(fecha, referencia, zonaHoraria) === 1;
}

/** El día calendario de `fecha` es anterior al de hoy. */
export function esPasadoEnZona(fecha: Date, zonaHoraria: string, referencia: Date = new Date()): boolean {
  return diasDeDiferenciaEnZona(fecha, referencia, zonaHoraria) < 0;
}

// ── Etiquetas ───────────────────────────────────────────────────────────────

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

// ── Resolución de la zona de presentación ───────────────────────────────────

/**
 * Cadena de prioridad para la zona con la que se *muestran* los instantes:
 * usuario → empresa → navegador → UTC.
 *
 * Función pura, para poder testear la cadena sin Next ni Prisma. Ojo con el
 * alcance: esto NO decide rangos de día, filtros ni KPIs — eso siempre usa la
 * zona de negocio (ver `negocio.ts`). Si la zona del usuario entrara en un
 * `where`, dos personas del mismo tenant verían totales distintos para "hoy".
 */
export function resolverZonaPresentacion(entradas: {
  zonaUsuario?: string | null;
  zonaEmpresa?: string | null;
  zonaNavegador?: string | null;
}): string {
  for (const candidata of [entradas.zonaUsuario, entradas.zonaEmpresa, entradas.zonaNavegador]) {
    if (esZonaHorariaValida(candidata)) return candidata;
  }
  return ZONA_FALLBACK;
}
