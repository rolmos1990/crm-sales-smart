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
    // `cuentaComoVenta` decide si este movimiento sella `Pedido.fechaVenta`.
    select: { id: true, nombre: true, flujoVentaId: true, cuentaComoVenta: true },
  });

  if (!etapa) return { exito: false, error: "Etapa no encontrada" };

  try {
    await _moverInterno(pedidoId, etapa.id, etapa.nombre, "MANUAL", usuarioId, notas, undefined, undefined, etapa.cuentaComoVenta);
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
  destinoCuentaComoVenta = false,
) {
  // Capture current stage name before moving.
  // `fechaVenta` se lee acá porque solo se sella si todavía está vacía.
  const pedidoActual = await prisma.pedido.findFirst({
    where: { id: pedidoId },
    select: { fechaVenta: true, flujoVentaEtapa: { select: { nombre: true } } },
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

  // 038 — un solo instante para las dos filas. Dos `new Date()` separados
  // darían valores distintos y romperían la invariante de que
  // `Pedido.fechaVenta` coincide con el `creadoEn` del movimiento que la
  // selló (de ahí se reconstruye si alguna vez hace falta recalcular).
  const momento = new Date();

  // `fechaVenta` se sella UNA SOLA VEZ: la primera vez que el pedido entra a
  // una etapa que cuenta como venta. Con "Pagado" y "Entregado" marcadas,
  // manda la fecha de "Pagado"; pasar después a "Entregado" no la mueve.
  // `undefined` deja la columna intacta (distinto de `null`, que la borraría).
  const sellarFechaVenta = destinoCuentaComoVenta && !pedidoActual?.fechaVenta;

  await prisma.$transaction([
    prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        flujoVentaEtapaId: etapaId,
        ...(sellarFechaVenta ? { fechaVenta: momento } : {}),
      },
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
        creadoEn: momento,
      },
    }),
  ]);
}
