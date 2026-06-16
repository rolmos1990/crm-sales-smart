"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";

interface ContextoPedido {
  total: number;
  flujoVentaEtapaId: string | null;
  metadata: Record<string, unknown>;
}

function leerCampo(campo: string, ctx: ContextoPedido): unknown {
  if (campo === "total") return ctx.total;
  if (campo === "flujoVentaEtapaId") return ctx.flujoVentaEtapaId;
  if (campo.startsWith("metadata.")) {
    const clave = campo.slice(9);
    return ctx.metadata[clave];
  }
  return undefined;
}

function evaluarCondicion(
  condicion: { campo: string; operador: string; valor: string },
  ctx: ContextoPedido,
): boolean {
  const valorCampo = leerCampo(condicion.campo, ctx);
  switch (condicion.operador) {
    case "IGUAL":        return String(valorCampo ?? "") === condicion.valor;
    case "DIFERENTE":    return String(valorCampo ?? "") !== condicion.valor;
    case "MAYOR_QUE":    return Number(valorCampo) > Number(condicion.valor);
    case "MENOR_QUE":    return Number(valorCampo) < Number(condicion.valor);
    case "CONTIENE":     return String(valorCampo ?? "").includes(condicion.valor);
    case "ES_VERDADERO": return valorCampo === true || valorCampo === "true";
    case "ES_FALSO":     return valorCampo === false || valorCampo === "false" || !valorCampo;
    default:             return false;
  }
}

export async function evaluarYMoverPedido(pedidoId: string): Promise<{ movido: boolean; etapaNombre?: string }> {
  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId },
    select: { flujoVentaId: true, flujoVentaEtapaId: true, total: true, metadata: true },
  });

  if (!pedido?.flujoVentaId) return { movido: false };

  // Cargar todas las reglas del flujo ordenadas por prioridad
  const reglas = await prisma.flujoVentaRegla.findMany({
    where: {
      activo: true,
      etapaDestino: { flujoVentaId: pedido.flujoVentaId, activo: true },
    },
    orderBy: { prioridad: "asc" },
    include: {
      condiciones: true,
      etapaDestino: { select: { id: true, nombre: true } },
    },
  });

  const ctx: ContextoPedido = {
    total: Number(pedido.total),
    flujoVentaEtapaId: pedido.flujoVentaEtapaId,
    metadata: (pedido.metadata as Record<string, unknown>) ?? {},
  };

  for (const regla of reglas) {
    // Saltar si ya está en la etapa destino
    if (regla.etapaDestinoId === pedido.flujoVentaEtapaId) continue;

    const todasCumplen = regla.condiciones.every((c) => evaluarCondicion(c, ctx));
    if (todasCumplen) {
      await _moverInterno(pedidoId, regla.etapaDestino.id, regla.etapaDestino.nombre, "AUTOMATICO", null, `Regla: ${regla.nombre}`);
      return { movido: true, etapaNombre: regla.etapaDestino.nombre };
    }
  }

  return { movido: false };
}

export async function moverPedidoAEtapa(
  pedidoId: string,
  etapaDestinoId: string,
  usuarioId: string | null,
  notas?: string,
): Promise<{ exito: true } | { exito: false; error: string }> {
  const etapa = await prisma.flujoVentaEtapa.findFirst({
    where: { id: etapaDestinoId, activo: true },
    select: { id: true, nombre: true },
  });

  if (!etapa) return { exito: false, error: "Etapa no encontrada" };

  try {
    await _moverInterno(pedidoId, etapa.id, etapa.nombre, "MANUAL", usuarioId, notas);
    revalidatePath(`/sales/pedidos/${pedidoId}`);
    return { exito: true };
  } catch {
    return { exito: false, error: "Error al mover el pedido" };
  }
}

async function _moverInterno(
  pedidoId: string,
  etapaId: string,
  etapaNombre: string,
  tipo: "MANUAL" | "AUTOMATICO",
  usuarioId: string | null,
  notas?: string,
) {
  await prisma.$transaction([
    prisma.pedido.update({
      where: { id: pedidoId },
      data: { flujoVentaEtapaId: etapaId },
    }),
    prisma.pedidoHistorialEtapa.create({
      data: { pedidoId, etapaId, etapaNombre, tipo, usuarioId: usuarioId ?? null, notas: notas ?? null },
    }),
  ]);
}
