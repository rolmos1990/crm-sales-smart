"use server";

import { requireSesion } from "@/shared/auth/sesion";
import { resolverCostoEnvio } from "./resolver-costo-envio";

// 019-cobertura-geografica-envios — usada por form-cotizacion.tsx y
// form-entrega.tsx para prellenar costoEnvio; reutiliza exactamente el
// mismo motor de resolución que las tools de IA (contracts/server-actions.md
// "Decisión de reutilización") — el humano siempre puede sobrescribir el
// valor sugerido a mano, a diferencia del agente de IA.
export async function obtenerCostoSugerido(input: {
  estadoProvinciaId: string;
  paisId?: string | null;
  ciudad?: string | null;
  metodoEntrega?: string | null;
  transportistaId?: string | null;
}): Promise<{ costo: number | null; cubierto: boolean; ambiguo: boolean }> {
  const sesion = await requireSesion();

  const { prisma } = await import("@/shared/db/prisma");
  const [pais, estado] = await Promise.all([
    input.paisId ? prisma.pais.findUnique({ where: { id: input.paisId }, select: { nombre: true } }) : null,
    prisma.estadoProvincia.findUnique({ where: { id: input.estadoProvinciaId }, select: { nombre: true } }),
  ]);
  if (!estado) return { costo: null, cubierto: false, ambiguo: false };

  const resolucion = await resolverCostoEnvio({
    instanciaId: sesion.instanciaId,
    pais: pais?.nombre ?? null,
    estadoProvincia: estado.nombre,
    ciudad: input.ciudad ?? null,
    metodoEntrega: input.metodoEntrega ?? undefined,
    transportistaId: input.transportistaId ?? undefined,
  });

  if (resolucion.estado === "SIN_COINCIDENCIA_CLARA") return { costo: null, cubierto: false, ambiguo: true };
  if (!resolucion.cubierto) return { costo: null, cubierto: false, ambiguo: false };
  return { costo: resolucion.costo, cubierto: true, ambiguo: false };
}
