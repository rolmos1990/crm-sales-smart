import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { PedidoActualizadoPayload } from "@/shared/eventos/registro";
import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

export class PedidoActualizadoSuscriptor extends ConsumidorBase {
  readonly queue = QUEUES.PEDIDO_HISTORIAL;
  readonly routingKeys = [RK.EVENTO_PEDIDO_ACTUALIZADO];

  async manejar(envelope: EventoEnvelope<PedidoActualizadoPayload>): Promise<void> {
    const { pedidoId, usuarioId, usuarioNombre, cambios } = envelope.payload;
    if (!cambios.length) return;
    await prisma.pedidoHistorial.createMany({
      data: cambios.map((c) => ({
        pedidoId,
        accion: c.accion,
        usuarioId: usuarioId ?? null,
        usuarioNombre: usuarioNombre ?? null,
        ...(c.valorAnterior !== undefined && { valorAnterior: c.valorAnterior as Prisma.InputJsonValue }),
        ...(c.valorNuevo !== undefined && { valorNuevo: c.valorNuevo as Prisma.InputJsonValue }),
      })),
    });
  }
}
