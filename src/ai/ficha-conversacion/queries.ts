// 031-memoria-y-ficha-conversacion — lectura de la ficha. Toda consulta va
// acotada a la instancia (FR-033): `conversacionId` solo no alcanza, porque
// un id filtrado de otro tenant devolvería datos ajenos.

import { prisma } from "@/shared/db/prisma";
import type { FichaConversacion, HechosConversacion, LecturaConversacion } from "./tipos";

/**
 * Ficha vigente de una conversación, o `null` si todavía no tiene. La
 * ausencia de fila es un estado válido: significa que el nodo recién activó
 * la ficha, o que es el primer turno.
 */
export async function obtenerFicha(conversacionId: string, instanciaId: string): Promise<FichaConversacion | null> {
  const fila = await prisma.fichaConversacionIA.findFirst({
    where: { conversacionId, instanciaId },
    select: { conversacionId: true, hechos: true, interpretado: true, turnos: true, actualizadoEn: true },
  });

  if (!fila) return null;

  return {
    conversacionId: fila.conversacionId,
    hechos: fila.hechos as unknown as HechosConversacion,
    interpretado: (fila.interpretado as unknown as LecturaConversacion | null) ?? null,
    turnos: fila.turnos,
    actualizadoEn: fila.actualizadoEn.toISOString(),
  };
}

/**
 * Momento en que un humano tomó esta conversación, si está tomada. La capa 6
 * lo compara con `actualizadoEn` de la ficha para decidir si sigue vigente,
 * en vez de mantener un flag que cada camino de transferencia tendría que
 * acordarse de apagar (research D14).
 */
export async function obtenerTomaHumana(conversacionId: string, instanciaId: string): Promise<Date | null> {
  const conversacion = await prisma.conversacion.findFirst({
    where: { id: conversacionId, instanciaId },
    select: { modoAtencion: true, atencionDesde: true },
  });

  if (!conversacion || conversacion.modoAtencion !== "HUMANO") return null;
  return conversacion.atencionDesde;
}
