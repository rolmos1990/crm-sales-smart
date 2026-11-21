import { prisma } from "@/shared/db/prisma";
import { obtenerZonaNegocio } from "@/shared/fechas/negocio";
import { rangoHoy, aFiltroPrisma } from "@/shared/fechas/rangos";

/**
 * 049 — Tope diario de minutos por proveedor.
 *
 * Control grueso para que un pico de audios no se lleve el saldo del mes. El
 * tope por archivo (VOZ_MAX_BYTES) cubre el caso del audio único enorme; este
 * cubre el del volumen.
 *
 * El corte del día sale de `obtenerZonaNegocio`, NO de la zona del servidor:
 * "hoy" tiene que significar lo mismo acá que en cualquier otro total de
 * Karia, o el tope se reiniciaría a una hora que al comercio no le dice nada.
 */

// Caché corta: esto se consulta antes de cada transcripción, y el consumo
// cambia de a un audio por vez. 30 s de desfase, en el peor caso, dejan pasar
// un audio de más — mucho más barato que una agregación por mensaje.
const TTL_MS = 30_000;
const cache = new Map<string, { minutos: number; vence: number }>();

export interface ResultadoLimite {
  permitido: boolean;
  motivo?: "LIMITE_MINUTOS_DIA";
  minutosConsumidos?: number;
  limite?: number;
}

export async function verificarLimiteDiario(
  instanciaId: string,
  limiteMinutosDia: number | null,
): Promise<ResultadoLimite> {
  if (limiteMinutosDia === null || limiteMinutosDia <= 0) return { permitido: true };

  const minutos = await minutosConsumidosHoy(instanciaId);
  if (minutos >= limiteMinutosDia) {
    return {
      permitido: false,
      motivo: "LIMITE_MINUTOS_DIA",
      minutosConsumidos: minutos,
      limite: limiteMinutosDia,
    };
  }
  return { permitido: true };
}

async function minutosConsumidosHoy(instanciaId: string): Promise<number> {
  const ahora = Date.now();
  const cacheado = cache.get(instanciaId);
  if (cacheado && cacheado.vence > ahora) return cacheado.minutos;

  const zona = await obtenerZonaNegocio(instanciaId);
  const rango = aFiltroPrisma(rangoHoy(zona))!;

  const r = await prisma.usoVoz.aggregate({
    where: { instanciaId, exito: true, creadoEn: rango },
    _sum: { segundos: true },
  });

  const minutos = (r._sum.segundos ?? 0) / 60;
  cache.set(instanciaId, { minutos, vence: ahora + TTL_MS });
  return minutos;
}

/** Suma local, para que varios audios de un mismo lote no pasen todos el tope. */
export function registrarConsumoLocal(instanciaId: string, segundos: number): void {
  const cacheado = cache.get(instanciaId);
  if (cacheado) cacheado.minutos += segundos / 60;
}

export function resetCacheLimites(): void {
  cache.clear();
}
