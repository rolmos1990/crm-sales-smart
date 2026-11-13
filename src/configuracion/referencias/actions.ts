"use server";

import { requireSesion } from "@/shared/auth/sesion";
import { buscarOpcionesReferencia, resolverReferencias } from "./queries";
import { extraerReferencias, claveDeReferencia } from "./parser";
import type { OpcionReferencia } from "./tipos";

// El `instanciaId` sale SIEMPRE de la sesión, nunca de un argumento del
// cliente — a diferencia de src/app/api/plantillas/route.ts, que lo toma del
// query string sin autenticar.

/** Candidatos para el menú que se abre al escribir `@`. */
export async function buscarReferenciasAction(consulta: string): Promise<OpcionReferencia[]> {
  const sesion = await requireSesion();
  return buscarOpcionesReferencia(sesion.instanciaId, consulta.slice(0, 100));
}

/**
 * Cuáles de las referencias escritas en un texto resuelven hoy. Alimenta la
 * tira de chips bajo el campo: una referencia que acá no aparece es la misma
 * que el prompt va a dejar literal.
 */
export async function verificarReferenciasAction(
  texto: string,
): Promise<{ token: string; etiqueta: string | null }[]> {
  const sesion = await requireSesion();
  const referencias = extraerReferencias(texto);
  if (referencias.length === 0) return [];

  const resueltas = await resolverReferencias(sesion.instanciaId, referencias);
  return referencias.map((ref) => ({
    token: ref.token,
    etiqueta: resueltas.get(claveDeReferencia(ref))?.etiqueta ?? null,
  }));
}
