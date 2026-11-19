// 031-memoria-y-ficha-conversacion — escritura de la ficha.
//
// Se llama SIEMPRE después de que el mensaje ya salió (research D9). Ninguna
// función de este módulo puede hacer fallar un envío que ya ocurrió: fallar
// acá significa perder una mejora, no perder el mensaje del cliente.

import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { derivarHechos, type TurnoEjecutado } from "./hechos";
import { obtenerFicha } from "./queries";
import { HECHOS_VACIOS, type HechosConversacion, type LecturaConversacion } from "./tipos";

export interface ParamsRegistrarTurno {
  conversacionId: string;
  instanciaId: string;
  turno: TurnoEjecutado;
}

/**
 * Registra los hechos de un turno. Idempotente por `conversacionId` (upsert):
 * reintentar el mismo turno deja la fila en el mismo estado.
 *
 * Devuelve los hechos ya persistidos, o `null` si algo falló — nunca lanza.
 */
export async function registrarTurno(params: ParamsRegistrarTurno): Promise<HechosConversacion | null> {
  try {
    const previa = await obtenerFicha(params.conversacionId, params.instanciaId);
    const previos: HechosConversacion = previa?.hechos ?? {
      ...HECHOS_VACIOS,
      ultimoTurnoEn: params.turno.ahora.toISOString(),
    };

    const hechos = derivarHechos(previos, params.turno);
    const datos = { hechos: hechos as unknown as Prisma.InputJsonValue };

    await prisma.fichaConversacionIA.upsert({
      where: { conversacionId: params.conversacionId },
      create: { ...datos, conversacionId: params.conversacionId, instanciaId: params.instanciaId, turnos: 1 },
      update: { ...datos, turnos: { increment: 1 } },
    });

    return hechos;
  } catch (err) {
    console.error("[FichaConversacion] No se pudo registrar el turno:", err);
    return null;
  }
}

/**
 * Guarda la lectura interpretada. Si `lectura` es `null` (la derivación falló
 * o devolvió algo ininteligible) no se toca nada: se conserva la anterior,
 * nunca se borra (FR-023, misma regla que `datosInterpretados` de la 012).
 */
export async function registrarLectura(
  conversacionId: string,
  instanciaId: string,
  lectura: LecturaConversacion | null,
): Promise<void> {
  if (!lectura) return;

  try {
    const previa = await obtenerFicha(conversacionId, instanciaId);
    // `updateMany` con instanciaId: acota al tenant y, si la fila todavía no
    // existe, no hace nada en vez de lanzar.
    await prisma.fichaConversacionIA.updateMany({
      where: { conversacionId, instanciaId },
      data: { interpretado: lectura as unknown as Prisma.InputJsonValue },
    });
    await marcarSiPasaASenalDeCompra(conversacionId, instanciaId, previa?.interpretado?.intencion ?? null, lectura.intencion);
  } catch (err) {
    console.error("[FichaConversacion] No se pudo guardar la lectura interpretada:", err);
  }
}

// 042 — Señal explícita de compra → el contacto se analiza como urgente (P0).
// Solo al ENTRAR en la señal: si cada turno con "listo para comprar" lo
// marcara, un cliente que conversa mucho dispararía un análisis por mensaje.
const SENALES_DE_COMPRA = new Set(["LISTO_PARA_COMPRAR", "LISTO_PARA_COTIZAR"]);

async function marcarSiPasaASenalDeCompra(
  conversacionId: string,
  instanciaId: string,
  anterior: string | null,
  nueva: string | null,
): Promise<void> {
  if (!nueva || !SENALES_DE_COMPRA.has(nueva) || (anterior && SENALES_DE_COMPRA.has(anterior))) return;
  const conversacion = await prisma.conversacion.findFirst({ where: { id: conversacionId, instanciaId }, select: { contactoId: true } });
  if (!conversacion) return;
  const { marcarPendienteSinFallar } = await import("@/crm/contactos/analisis/cola");
  await marcarPendienteSinFallar({
    instanciaId,
    contactoId: conversacion.contactoId,
    prioridad: "P0",
    motivo: "MENSAJE",
    inmediato: true,
  });
}
