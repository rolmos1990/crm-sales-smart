import { prisma } from "@/shared/db/prisma";
import { MONEDA_DEFAULT } from "@/shared/moneda/constants";
import type { ConfigEmpresa } from "./types";

export async function obtenerConfiguracionEmpresa(instanciaId: string): Promise<ConfigEmpresa | null> {
  return prisma.configuracionEmpresa.findUnique({
    where: { instanciaId },
  });
}

/**
 * 049 — ¿La cuenta tiene la transcripción de notas de voz encendida?
 *
 * Caché corta porque se consulta por CADA mensaje entrante: sin ella, cada
 * audio agregaría una lectura al camino caliente de recepción. El toggle
 * cambia muy de vez en cuando, así que 60 s de desfase es aceptable y el peor
 * caso es que un audio quede sin transcribir hasta el barrido siguiente.
 */
const TTL_TRANSCRIPCION_MS = 60_000;
const cacheTranscripcion = new Map<string, { valor: boolean; vence: number }>();

export async function obtenerTranscripcionVozHabilitada(instanciaId: string): Promise<boolean> {
  const ahora = Date.now();
  const cacheado = cacheTranscripcion.get(instanciaId);
  if (cacheado && cacheado.vence > ahora) return cacheado.valor;

  const config = await prisma.configuracionEmpresa
    .findUnique({ where: { instanciaId }, select: { transcripcionVozHabilitada: true } })
    .catch(() => null);

  const valor = config?.transcripcionVozHabilitada ?? false;
  cacheTranscripcion.set(instanciaId, { valor, vence: ahora + TTL_TRANSCRIPCION_MS });
  return valor;
}

/** Para que guardar el toggle se note en el acto, sin esperar al TTL. */
export function invalidarCacheTranscripcionVoz(instanciaId: string): void {
  cacheTranscripcion.delete(instanciaId);
}

export async function obtenerMonedaPrincipal(instanciaId: string): Promise<string> {
  const config = await prisma.configuracionEmpresa.findUnique({
    where: { instanciaId },
    select: { monedaPrincipal: true },
  });
  return config?.monedaPrincipal ?? MONEDA_DEFAULT;
}

/** 029-combos-productos-compuestos — pestaña inicial del selector de productos. */
export async function obtenerFiltroProductosPedido(instanciaId: string): Promise<"TODOS" | "PRODUCTOS" | "COMBOS"> {
  const config = await prisma.configuracionEmpresa
    .findUnique({ where: { instanciaId }, select: { filtroProductosPedido: true } })
    .catch(() => null);
  return config?.filtroProductosPedido ?? "TODOS";
}
