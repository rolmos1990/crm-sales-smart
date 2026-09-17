import { prisma } from "@/shared/db/prisma";
import { publicadorEventos } from "@/shared/rabbitmq";
import { EventosSistema } from "@/eventos/catalogo";
import { calcularSellado } from "./sellado";
import { asegurarPreparacionPedido } from "./asegurar-preparacion-pedido";
import type { ResultadoMovimiento } from "../types";

/**
 * Motor de transición del eje de preparación.
 *
 * Concurrencia: `updateMany` condicionado al estado que el cliente tenía en
 * pantalla es un compare-and-swap atómico en Postgres. Si `count === 0`, otro
 * usuario movió la tarjeta primero y devolvemos CONFLICTO sin aplicar nada —
 * nunca se pierde ni se duplica un movimiento (research.md Decisión 2).
 *
 * Los eventos se publican DESPUÉS del commit: un fallo de la cola no revierte
 * el movimiento (constitución, principio III).
 */
export async function moverPreparacion(params: {
  pedidoId: string;
  estadoDestinoId: string;
  estadoEsperadoId: string;
  instanciaId: string;
  usuarioId: string | null;
  tipo?: "MANUAL" | "AUTOMATICO";
}): Promise<ResultadoMovimiento> {
  const { pedidoId, estadoDestinoId, estadoEsperadoId, instanciaId, usuarioId, tipo = "MANUAL" } = params;

  await asegurarPreparacionPedido(pedidoId, instanciaId);

  const preparacion = await prisma.preparacionPedido.findUnique({
    where: { pedidoId },
    select: {
      id: true,
      estadoId: true,
      iniciadaEn: true,
      completadaEn: true,
      asignadaAId: true,
      estado: { select: { nombre: true, esFinal: true, flujoPreparacionId: true } },
      pedido: {
        select: {
          numero: true,
        },
      },
    },
  });
  if (!preparacion) return { ok: false, motivo: "NO_ENCONTRADO" };

  const destino = await prisma.estadoPreparacion.findFirst({
    where: {
      id: estadoDestinoId,
      activo: true,
      // El destino tiene que pertenecer al mismo flujo: cierra la puerta a
      // mover un pedido a un estado de otra instancia.
      flujoPreparacionId: preparacion.estado.flujoPreparacionId,
      flujoPreparacion: { instanciaId },
    },
    select: { id: true, nombre: true, marcaInicio: true, esFinal: true },
  });
  if (!destino) return { ok: false, motivo: "ESTADO_INVALIDO" };

  // Movimiento a la misma columna: no hay nada que hacer ni que auditar.
  if (preparacion.estadoId === destino.id) return { ok: true, estadoId: destino.id };

  const sellado = calcularSellado({
    actual: {
      estadoId: preparacion.estadoId,
      iniciadaEn: preparacion.iniciadaEn,
      completadaEn: preparacion.completadaEn,
      asignadaAId: preparacion.asignadaAId,
      estadoNombre: preparacion.estado.nombre,
      estadoActualEsFinal: preparacion.estado.esFinal,
    },
    destino,
    usuarioId,
    ahora: new Date(),
  });

  const usuarioNombre = usuarioId
    ? await prisma.usuario
        .findFirst({ where: { id: usuarioId }, select: { nombre: true } })
        .then((u) => u?.nombre ?? null)
    : null;

  const aplicado = await prisma.$transaction(async (tx) => {
    const { count } = await tx.preparacionPedido.updateMany({
      where: { id: preparacion.id, estadoId: estadoEsperadoId },
      data: {
        estadoId: destino.id,
        iniciadaEn: sellado.iniciadaEn,
        completadaEn: sellado.completadaEn,
        asignadaAId: sellado.asignadaAId,
      },
    });
    if (count === 0) return false;

    await tx.preparacionHistorial.create({
      data: {
        preparacionId: preparacion.id,
        estadoId: destino.id,
        estadoNombre: destino.nombre,
        estadoAnteriorNombre: preparacion.estado.nombre,
        tipo,
        usuarioId,
        usuarioNombre,
      },
    });

    // Llegar al estado final da por preparado todo el pedido: se completan de
    // una vez las líneas que quedaron a medias. Un UPDATE con referencia entre
    // columnas (no se puede expresar con updateMany) y solo sobre las
    // incompletas, para no repisar quién y cuándo preparó las que ya estaban.
    // Retroceder después NO las desmarca: lo preparado, preparado queda.
    if (sellado.completa) {
      await tx.$executeRaw`
        UPDATE "PedidoLinea"
        SET "cantidadPreparada" = "cantidad",
            "preparadaEn" = ${sellado.completadaEn},
            "preparadaPorId" = ${usuarioId}
        WHERE "pedidoId" = ${pedidoId}
          AND "cantidadPreparada" < "cantidad"
      `;
    }

    return true;
  });

  if (!aplicado) return { ok: false, motivo: "CONFLICTO" };

  if (sellado.sellaInicio && sellado.iniciadaEn) {
    await publicadorEventos.publicar(EventosSistema.PreparacionIniciada, instanciaId, {
      instanciaId,
      pedidoId,
      numero: preparacion.pedido.numero,
      estadoId: destino.id,
      estadoNombre: destino.nombre,
      iniciadaEn: sellado.iniciadaEn.toISOString(),
      usuarioId,
    });
  }

  if (sellado.completa && sellado.completadaEn) {
    await publicadorEventos.publicar(EventosSistema.PreparacionCompletada, instanciaId, {
      instanciaId,
      pedidoId,
      numero: preparacion.pedido.numero,
      estadoId: destino.id,
      estadoNombre: destino.nombre,
      iniciadaEn: sellado.iniciadaEn?.toISOString() ?? null,
      completadaEn: sellado.completadaEn.toISOString(),
      asignadaAId: sellado.asignadaAId,
      // Siempre true: entrar al estado final acaba de completar las líneas que
      // faltaban. Los eventos por línea NO se emiten acá a propósito — el hecho
      // ya lo comunica este evento, y emitir uno por línea sería duplicar la
      // misma señal en ráfaga.
      avanceCompleto: true,
    });
  }

  return { ok: true, estadoId: destino.id };
}
