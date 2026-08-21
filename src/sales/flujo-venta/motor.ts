"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { procesarCambioEtapaPedido } from "./disparadores/motor";
import { validarPedidoParaEtapa } from "./reglas/motor";
import type { ResultadoEvaluacion } from "./reglas/tipos";

/**
 * Valida si un pedido puede pasar a `etapaDestinoId` contra las Reglas de
 * validación activas de esa etapa (ver src/sales/flujo-venta/reglas/motor.ts
 * — el servicio central, también usado por el ejecutor de disparadores para
 * que las automatizaciones nunca se salten una regla). Devuelve además el
 * resultado rico (`detalle`) para mostrar requisitos pendientes en la UI.
 */
export async function validarTransicion(
  pedidoId: string,
  etapaDestinoId: string,
): Promise<{ permitido: boolean; motivo?: string; detalle?: ResultadoEvaluacion }> {
  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId },
    select: { instanciaId: true },
  });
  if (!pedido) return { permitido: false, motivo: "Pedido no encontrado" };
  if (!pedido.instanciaId) return { permitido: true };

  const resultado = await validarPedidoParaEtapa(prisma, pedidoId, etapaDestinoId, pedido.instanciaId);

  if (!resultado.esValido && resultado.reglaFallida) {
    const motivo = resultado.reglaFallida.mensajeFallo?.trim()
      || `Requisito no cumplido: "${resultado.reglaFallida.nombre}"`;
    return { permitido: false, motivo, detalle: resultado };
  }

  return { permitido: resultado.esValido, detalle: resultado };
}

export async function moverPedidoAEtapa(
  pedidoId: string,
  etapaDestinoId: string,
  usuarioId: string | null,
  notas?: string,
): Promise<{ exito: true } | { exito: false; error: string }> {
  const etapa = await prisma.flujoVentaEtapa.findFirst({
    where: { id: etapaDestinoId, activo: true },
    select: { id: true, nombre: true, flujoVentaId: true },
  });

  if (!etapa) return { exito: false, error: "Etapa no encontrada" };

  try {
    await _moverInterno(pedidoId, etapa.id, etapa.nombre, "MANUAL", usuarioId, notas);
    await procesarCambioEtapaPedido(pedidoId, etapa.id, etapa.flujoVentaId);
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
  origen?: string,
  referencia?: string,
) {
  // Capture current stage name before moving
  const pedidoActual = await prisma.pedido.findFirst({
    where: { id: pedidoId },
    select: { flujoVentaEtapa: { select: { nombre: true } } },
  });

  // Resolve user display name
  let usuarioNombre: string | null = null;
  if (usuarioId) {
    const usuario = await prisma.usuario.findFirst({
      where: { id: usuarioId },
      select: { nombre: true },
    });
    if (usuario) usuarioNombre = usuario.nombre;
  }

  const etapaAnteriorNombre = pedidoActual?.flujoVentaEtapa?.nombre ?? null;
  const origenFinal = origen ?? (tipo === "MANUAL" ? "USUARIO" : "SISTEMA");

  await prisma.$transaction([
    prisma.pedido.update({
      where: { id: pedidoId },
      data: { flujoVentaEtapaId: etapaId },
    }),
    prisma.pedidoHistorialEtapa.create({
      data: {
        pedidoId,
        etapaId,
        etapaNombre,
        etapaAnteriorNombre,
        tipo,
        origen: origenFinal,
        usuarioId: usuarioId ?? null,
        usuarioNombre,
        notas: notas ?? null,
        referencia: referencia ?? null,
      },
    }),
  ]);
}
