// 041 — Umbrales de seguimiento → instantes de corte. Puro (sin Prisma) para
// poder probar los bordes sin base de datos. Ver data-model.md "Cortes".
import { hoyEnZona, inicioDiaEnZona, sumarDias } from "@/shared/fechas/zona";

export interface UmbralesSeguimiento {
  pendiente: number;
  recuperar: number;
  inactivo: number;
}

export const UMBRALES_SEGUIMIENTO_DEFECTO: UmbralesSeguimiento = { pendiente: 3, recuperar: 7, inactivo: 60 };

export interface CortesSeguimiento {
  ahora: Date;
  pendiente: Date;
  recuperar: Date;
  inactivo: Date;
}

/**
 * `corte X = inicio del día de hoy (zona de negocio) − X días`. Una referencia
 * `≥ corte` es "más reciente que el umbral"; `< corte`, "igual o más antigua".
 * Se cuenta en días de calendario del negocio y no en horas: una interacción
 * de anoche a las 23:00 es "hace 1 día" aunque hayan pasado 2 horas.
 */
export function calcularCortes(
  zonaNegocio: string,
  umbrales: UmbralesSeguimiento,
  ahora: Date = new Date(),
): CortesSeguimiento {
  const hoy = hoyEnZona(zonaNegocio, ahora);
  const corte = (dias: number) => inicioDiaEnZona(sumarDias(hoy, -dias), zonaNegocio);
  return {
    ahora,
    pendiente: corte(umbrales.pendiente),
    recuperar: corte(umbrales.recuperar),
    inactivo: corte(umbrales.inactivo),
  };
}

export const RANGOS_ULTIMA_ACTIVIDAD = ["HOY", "ULTIMOS_7", "ULTIMOS_30", "MAS_DE_30", "SIN_ACTIVIDAD"] as const;
export type RangoUltimaActividad = (typeof RANGOS_ULTIMA_ACTIVIDAD)[number];

/**
 * Filtro sobre `ultimaInteraccionEn` para la opción elegida. Sin cota superior:
 * una interacción no puede estar en el futuro, y `lt` de mañana no aporta.
 */
export function filtroUltimaActividad(
  rango: RangoUltimaActividad,
  zonaNegocio: string,
  ahora: Date = new Date(),
): { gte: Date } | { lt: Date } | null {
  const hoy = hoyEnZona(zonaNegocio, ahora);
  const inicioHace = (dias: number) => inicioDiaEnZona(sumarDias(hoy, -dias), zonaNegocio);
  switch (rango) {
    case "HOY":
      return { gte: inicioHace(0) };
    case "ULTIMOS_7":
      return { gte: inicioHace(6) };
    case "ULTIMOS_30":
      return { gte: inicioHace(29) };
    case "MAS_DE_30":
      return { lt: inicioHace(29) };
    case "SIN_ACTIVIDAD":
      return null;
  }
}
