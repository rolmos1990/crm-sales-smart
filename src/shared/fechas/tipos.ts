/**
 * Las tres clases de valor temporal de Karia. La distinción importa porque
 * cada una se convierte de forma distinta — mezclarlas es el origen de los
 * corrimientos de día y de hora.
 *
 * Regla arquitectónica: Karia almacena, transmite y procesa timestamps
 * internos en UTC. La zona horaria IANA efectiva viaja como contexto. Las
 * fechas/horas locales de entrada se interpretan usando esa zona y se
 * convierten a UTC cuando representan un instante. Las fechas calendario
 * puras no se convierten como timestamps.
 */

/**
 * Un momento real en el tiempo (creación de pedido, mensaje enviado, pago).
 * Se almacena y transmite en UTC. Es el caso por defecto.
 */
export type Instante = Date;

/**
 * Fecha + hora de pared *sin* zona: "2026-09-17T14:30".
 *
 * Solo existe en el borde de la UI (el valor de un `<input
 * type="datetime-local">`). Nunca se persiste: se convierte a `Instante` con
 * `aInstante(valor, zona)` antes de tocar la base de datos.
 */
export type FechaHoraLocal = string & { readonly __marca: "FechaHoraLocal" };

/**
 * Fecha de calendario pura: "2026-09-17". Sin hora, sin zona.
 *
 * Un cumpleaños o un vencimiento que funcionalmente es solo un día. NUNCA se
 * convierte como timestamp — eso es justo lo que corre el día.
 *
 * Convención de almacenamiento mientras las columnas sigan siendo `DateTime`
 * (no hay `@db.Date` en el schema): se guarda la medianoche local de la zona
 * de negocio, escrita solo vía `desdeFechaCalendario()` y leída solo vía
 * `aFechaCalendario()`. Ese par es lo que mantiene el día estable; leer la
 * columna con `.toISOString().slice(0, 10)` lo rompe en toda zona con offset
 * negativo.
 */
export type FechaCalendario = string & { readonly __marca: "FechaCalendario" };

/** Componentes de una fecha de calendario, ya descompuestos. */
export interface FechaYMD {
  anio: number;
  mes: number; // 1-12
  dia: number;
}

/** Rango temporal siempre semiabierto: [desde, hasta). */
export interface RangoUtc {
  desde: Date;
  hasta: Date;
}
