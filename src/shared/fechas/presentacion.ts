/**
 * Preferencias de **presentación** de fechas: con qué zona, locale y formato se
 * renderiza un instante en pantalla.
 *
 * Cadena de prioridad de la zona: usuario → empresa → navegador → UTC.
 * El navegador llega vía el header `x-time-zone`, que el middleware promueve
 * desde la cookie `karia_tz` (ver src/middleware.ts).
 *
 * Alcance: esto NO decide rangos de día, filtros ni KPIs. Para eso está
 * `negocio.ts`. La regla a sostener en revisión de código es simple: si un
 * valor termina en un `where` de Prisma, salió de `obtenerZonaNegocio`.
 *
 * Solo servidor: importa `next/headers`, que ya falla por sí solo si alguien
 * lo arrastra a un Client Component (por eso no hace falta el paquete
 * `server-only`, que no está instalado). El worker tampoco debe importar este
 * módulo — no tiene request, y tampoco tiene a quién mostrarle nada.
 */

import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/shared/db/prisma";
import { resolverZonaPresentacion } from "./zona";
import { normalizarZonaNegocio } from "./negocio";
import {
  esFormatoFecha,
  esFormatoHora,
  LOCALE_DEFAULT,
  PREFERENCIAS_FECHA_DEFAULT,
  type PreferenciasFecha,
} from "./formato";

export type { PreferenciasFecha } from "./formato";
export { PREFERENCIAS_FECHA_DEFAULT } from "./formato";

/** Nombre de la cookie que el cliente escribe con la zona detectada. */
export const COOKIE_ZONA = "karia_tz";

/** Header que el middleware deriva de esa cookie. */
export const HEADER_ZONA = "x-time-zone";

/**
 * Zona detectada por el navegador, si el middleware la dejó en el request.
 *
 * Es una pista no confiable (el cliente escribe la cookie), por eso el
 * middleware ya la validó contra IANA y solo se usa como último recurso antes
 * de UTC. Nunca para cálculos de negocio.
 */
async function obtenerZonaNavegador(): Promise<string | null> {
  try {
    return (await headers()).get(HEADER_ZONA);
  } catch {
    // Contexto sin request (render estático): simplemente no hay pista.
    return null;
  }
}

const obtenerConfigPresentacion = cache(async (instanciaId: string) => {
  try {
    return await prisma.configuracionEmpresa.findUnique({
      where: { instanciaId },
      select: { zonaHoraria: true, formatoFecha: true, formatoHora: true },
    });
  } catch {
    return null;
  }
});

/**
 * Preferencias completas con las que formatear fechas para este usuario.
 *
 * `locale` queda fijado en es-PE a propósito: derivarlo de
 * `idiomaPrincipal` + `pais` cambiaría en silencio el texto de toda fecha ya
 * visible en los tenants que no son de Perú.
 */
export async function obtenerPreferenciasFechaEfectivas(opciones: {
  instanciaId?: string | null;
  zonaUsuario?: string | null;
}): Promise<PreferenciasFecha> {
  const { instanciaId, zonaUsuario } = opciones;
  if (!instanciaId) return { ...PREFERENCIAS_FECHA_DEFAULT };

  const [config, zonaNavegador] = await Promise.all([
    obtenerConfigPresentacion(instanciaId),
    obtenerZonaNavegador(),
  ]);

  return {
    zonaHoraria: resolverZonaPresentacion({
      zonaUsuario,
      zonaEmpresa: config?.zonaHoraria,
      zonaNavegador,
    }),
    locale: LOCALE_DEFAULT,
    formatoFecha: esFormatoFecha(config?.formatoFecha)
      ? config.formatoFecha
      : PREFERENCIAS_FECHA_DEFAULT.formatoFecha,
    formatoHora: esFormatoHora(config?.formatoHora)
      ? config.formatoHora
      : PREFERENCIAS_FECHA_DEFAULT.formatoHora,
  };
}

/**
 * Solo la zona de presentación. Atajo para Server Components que formatean una
 * fecha suelta y no necesitan el resto de las preferencias.
 *
 * Si lo que hace falta es filtrar o agrupar por día, esta NO es la función:
 * usar `obtenerZonaNegocio(instanciaId)` de `negocio.ts`.
 */
export async function obtenerZonaPresentacionEfectiva(opciones: {
  instanciaId?: string | null;
  zonaUsuario?: string | null;
}): Promise<string> {
  return (await obtenerPreferenciasFechaEfectivas(opciones)).zonaHoraria;
}

export { normalizarZonaNegocio };
