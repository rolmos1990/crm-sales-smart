/**
 * Zona horaria **de negocio** — la única fuente válida para matemática de
 * fechas: rangos de día, filtros, KPIs, cuotas y reglas.
 *
 * Es siempre la zona de la empresa (`ConfiguracionEmpresa.zonaHoraria`), nunca
 * la del usuario ni la del navegador. Ese es justamente el punto: si la zona
 * del usuario decidiera los rangos, dos personas del mismo tenant verían
 * totales distintos para "ventas de hoy" y no habría forma de reconciliarlos.
 * Un administrador en España mirando una empresa de Panamá debe seguir viendo
 * el día operativo de Panamá.
 *
 * Para *mostrar* un instante en pantalla se usa `presentacion.ts`, que sí
 * aplica la cadena usuario → empresa → navegador → UTC.
 *
 * Este módulo NO importa `next/headers`: también lo usa el worker standalone
 * (`src/worker/disparadores.ts`) y los suscriptores, que corren fuera de
 * Next.js y no tienen request. Por eso recibe `instanciaId` explícito.
 */

import { cache } from "react";
import { prisma } from "@/shared/db/prisma";
import { esZonaHorariaValida, ZONA_FALLBACK, ZONA_NEGOCIO_FALLBACK } from "./zona";

// Reexportada por conveniencia. La definición vive en `zona.ts` porque este
// módulo importa Prisma y no puede entrar en un bundle de cliente.
export { ZONA_NEGOCIO_FALLBACK };

/**
 * Zona de negocio de una instancia.
 *
 * Memoizada por request con `cache()` de React: varias queries de la misma
 * página la piden y no tiene sentido ir a la base cada vez. En el worker
 * `cache()` degrada a una llamada directa, que es lo correcto ahí.
 */
export const obtenerZonaNegocio = cache(async (instanciaId: string): Promise<string> => {
  try {
    const config = await prisma.configuracionEmpresa.findUnique({
      where: { instanciaId },
      select: { zonaHoraria: true },
    });
    return normalizarZonaNegocio(config?.zonaHoraria);
  } catch {
    // Sin base configurada o instancia inexistente: no es motivo para romper
    // la pantalla, el fallback da un resultado coherente.
    return ZONA_NEGOCIO_FALLBACK;
  }
});

/** Valida una zona ya leída de la base, sin volver a consultarla. */
export function normalizarZonaNegocio(zona: string | null | undefined): string {
  if (esZonaHorariaValida(zona)) return zona;
  return ZONA_NEGOCIO_FALLBACK;
}

export { ZONA_FALLBACK };
