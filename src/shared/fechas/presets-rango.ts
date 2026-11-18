import { sumarDias } from "./zona";
import type { FechaYMD } from "./tipos";

/**
 * Atajos de los filtros de rango de fechas.
 *
 * Viven en un módulo plano —y no dentro de `components/filtro-rango-fechas.tsx`—
 * porque son lógica pura y así se prueban como tal: la suite de Vitest corre
 * en entorno node y no parsea TSX.
 */
export interface PresetRangoFechas {
  etiqueta: string;
  /**
   * Recibe el día de hoy **en la zona de negocio**, no en la del navegador.
   * `null` en un extremo deja el rango abierto de ese lado ("todo lo anterior
   * a ayer"), que es lo que ya soportan los `where` parciales del servidor.
   */
  calcular: (hoy: FechaYMD) => { desde: FechaYMD | null; hasta: FechaYMD | null };
}

const soloDia = (d: FechaYMD) => ({ desde: d, hasta: d });

/** Para fechas que ya ocurrieron (fecha de pedido, de creación, de cierre). */
export const PRESETS_RANGO_PASADO: PresetRangoFechas[] = [
  { etiqueta: "Hoy", calcular: soloDia },
  { etiqueta: "Ayer", calcular: (hoy) => soloDia(sumarDias(hoy, -1)) },
  { etiqueta: "Últimos 7 días", calcular: (hoy) => ({ desde: sumarDias(hoy, -6), hasta: hoy }) },
  { etiqueta: "Últimos 30 días", calcular: (hoy) => ({ desde: sumarDias(hoy, -29), hasta: hoy }) },
  { etiqueta: "Este mes", calcular: (hoy) => ({ desde: { ...hoy, dia: 1 }, hasta: hoy }) },
  {
    etiqueta: "Mes pasado",
    calcular: (hoy) => {
      const ultimoDelPasado = sumarDias({ ...hoy, dia: 1 }, -1);
      return { desde: { ...ultimoDelPasado, dia: 1 }, hasta: ultimoDelPasado };
    },
  },
];

/**
 * Para la fecha de venta del pedido (038). Ventanas móviles "últimos N días
 * incluyendo hoy", que es como el negocio mira el cierre comercial, en vez de
 * los meses calendario de PRESETS_RANGO_PASADO.
 */
export const PRESETS_RANGO_VENTA: PresetRangoFechas[] = [
  { etiqueta: "Hoy", calcular: soloDia },
  { etiqueta: "Ayer", calcular: (hoy) => soloDia(sumarDias(hoy, -1)) },
  { etiqueta: "Última semana", calcular: (hoy) => ({ desde: sumarDias(hoy, -6), hasta: hoy }) },
  { etiqueta: "Últimos 15 días", calcular: (hoy) => ({ desde: sumarDias(hoy, -14), hasta: hoy }) },
  { etiqueta: "Último mes", calcular: (hoy) => ({ desde: sumarDias(hoy, -29), hasta: hoy }) },
];

/** Para fechas que están por venir (entrega estimada, vencimiento). */
export const PRESETS_RANGO_FUTURO: PresetRangoFechas[] = [
  { etiqueta: "Hoy", calcular: soloDia },
  { etiqueta: "Mañana", calcular: (hoy) => soloDia(sumarDias(hoy, 1)) },
  { etiqueta: "Hoy y mañana", calcular: (hoy) => ({ desde: hoy, hasta: sumarDias(hoy, 1) }) },
  { etiqueta: "Próximos 7 días", calcular: (hoy) => ({ desde: hoy, hasta: sumarDias(hoy, 6) }) },
  { etiqueta: "Próximos 30 días", calcular: (hoy) => ({ desde: hoy, hasta: sumarDias(hoy, 29) }) },
  // Abierto por la izquierda a propósito: "atrasado" es todo lo anterior a
  // hoy, sin un piso arbitrario.
  { etiqueta: "Atrasados", calcular: (hoy) => ({ desde: null, hasta: sumarDias(hoy, -1) }) },
];
