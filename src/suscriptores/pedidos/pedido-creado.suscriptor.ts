import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { PedidoCreadoPayload } from "@/eventos/contratos/pedido-creado.event";
import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

export class PedidoCreadoSuscriptor extends ConsumidorBase {
  readonly queue = QUEUES.PEDIDO_HISTORIAL;
  readonly routingKeys = [RK.EVENTO_PEDIDO_CREADO];

  async manejar(envelope: EventoEnvelope<PedidoCreadoPayload>): Promise<void> {
    const { pedidoId, numero, total, usuarioId, usuarioNombre } = envelope.payload;
    await prisma.pedidoHistorial.create({
      data: {
        pedidoId,
        accion: "PEDIDO_CREADO",
        usuarioId: usuarioId ?? null,
        usuarioNombre: usuarioNombre ?? null,
        valorNuevo: { numero, total } as Prisma.InputJsonValue,
      },
    });
  }
}
