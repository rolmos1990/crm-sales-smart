import { hoyEnZona, inicioDiaEnZona, rangoDiaEnZona, sumarDias } from "@/sales/pedidos/utils/fechas-zona";
import type { RangoPreparacion } from "@/generated/prisma/enums";

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

/**
 * Resuelve los rangos del tablero sobre `fechaEntrega`.
 *
 * Reutiliza las utilidades de fechas del listado de pedidos a propósito: si
 * Preparación calculara "hoy" por su cuenta, los contadores del tablero y los
 * del listado podrían no coincidir cerca de medianoche (research.md Decisión 7).
 */
export function resolverRango(
  rango: RangoPreparacion,
  zonaHoraria: string,
  personalizado?: { desde?: Date; hasta?: Date },
  referencia: Date = new Date(),
): RangoFechas | null {
  switch (rango) {
    case "HOY":
      return rangoDiaEnZona(zonaHoraria, 0, referencia);
    case "MANANA":
      return rangoDiaEnZona(zonaHoraria, 1, referencia);
    case "SEMANA":
      return rangoSemanaEnZona(zonaHoraria, referencia);
    case "PERSONALIZADO": {
      if (!personalizado?.desde && !personalizado?.hasta) return null;
      const hoy = rangoDiaEnZona(zonaHoraria, 0, referencia);
      return {
        desde: personalizado.desde ?? hoy.desde,
        // Sin tope explícito, el rango queda abierto hacia adelante.
        hasta: personalizado.hasta ?? new Date(8640000000000000),
      };
    }
  }
}

/**
 * "Esta semana" = desde el inicio de hoy hasta el fin del séptimo día, en la
 * zona horaria de negocio. Incluye hoy: quien abre el tablero un viernes
 * espera ver lo de hoy dentro de "esta semana", no solo lo que viene.
 */
export function rangoSemanaEnZona(zonaHoraria: string, referencia: Date = new Date()): RangoFechas {
  const hoy = hoyEnZona(zonaHoraria, referencia);
  return {
    desde: inicioDiaEnZona(hoy, zonaHoraria),
    hasta: inicioDiaEnZona(sumarDias(hoy, 7), zonaHoraria),
  };
}

/** Filtro Prisma para `fechaEntrega`. `null` = sin filtro de fecha. */
export function filtroFechaEntrega(rango: RangoFechas | null) {
  if (!rango) return undefined;
  return { gte: rango.desde, lt: rango.hasta };
}

/**
 * Inicio del día de hoy en la zona de negocio — la frontera de "atrasado".
 */
export function inicioDeHoyEnZona(zonaHoraria: string, referencia: Date = new Date()): Date {
  return rangoDiaEnZona(zonaHoraria, 0, referencia).desde;
}

/**
 * Filtro de pedidos atrasados: fecha de entrega anterior a hoy.
 *
 * Existen porque los rangos del tablero (hoy / mañana / esta semana) miran
 * hacia adelante, y un pedido abierto cuya entrega ya venció no cae en ninguno
 * — quedaría invisible justo el que más urge. Se muestran siempre, en cualquier
 * rango, igual que los pedidos sin fecha.
 */
export function filtroAtrasados(zonaHoraria: string, referencia: Date = new Date()) {
  return { lt: inicioDeHoyEnZona(zonaHoraria, referencia) };
}

/** Un pedido está atrasado si su entrega quedó antes del día de hoy. */
export function estaAtrasado(
  fechaEntrega: Date | null,
  zonaHoraria: string,
  referencia: Date = new Date(),
): boolean {
  if (!fechaEntrega) return false;
  return fechaEntrega < inicioDeHoyEnZona(zonaHoraria, referencia);
}
