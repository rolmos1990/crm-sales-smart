import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { PedidoCreadoPayload } from "@/eventos/contratos/pedido-creado.event";
import type { PedidoActualizadoPayload } from "@/eventos/contratos/pedido-actualizado.event";
import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

type PedidoHistorialPayload = PedidoCreadoPayload | PedidoActualizadoPayload;

// PEDIDO_CREADO y PEDIDO_ACTUALIZADO comparten una sola cola física
// (QUEUES.PEDIDO_HISTORIAL). Antes cada uno tenía su propio Suscriptor
// consumiendo de esa misma cola: RabbitMQ reparte mensajes de una cola entre
// todos sus consumidores (competing consumers), así que cada handler recibía
// al azar mensajes del otro tipo y fallaba (ej. el handler de actualizado
// leyendo `.cambios` de un payload de PEDIDO_CREADO, que no lo tiene). Un
// único consumidor por cola, que distingue por envelope.tipo, evita el cruce.
//
// routingKeys vacío a propósito: configurarTopologia() (conexion.ts) ya deja
// esta cola bindeada a "evento.pedido.*". Si este Suscriptor agregara además
// sus propias claves específicas ("evento.pedido.creado", ".actualizado"),
// quedarían DOS bindings distintos matcheando la misma routing key sobre la
// misma cola — RabbitMQ no deduplica eso, así que cada mensaje se encolaría
// dos veces (eso es lo que causaba el "Pedido creado" duplicado).
export class PedidoHistorialSuscriptor extends ConsumidorBase<PedidoHistorialPayload> {
  readonly queue = QUEUES.PEDIDO_HISTORIAL;
  readonly routingKeys: string[] = [];

  async manejar(envelope: EventoEnvelope<PedidoHistorialPayload>): Promise<void> {
    if (envelope.tipo === "PEDIDO_CREADO") {
      const { pedidoId, numero, total, usuarioId, usuarioNombre } = envelope.payload as PedidoCreadoPayload;
      await prisma.pedidoHistorial.create({
        data: {
          pedidoId,
          accion: "PEDIDO_CREADO",
          usuarioId: usuarioId ?? null,
          usuarioNombre: usuarioNombre ?? null,
          valorNuevo: { numero, total } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    if (envelope.tipo === "PEDIDO_ACTUALIZADO") {
      const { pedidoId, usuarioId, usuarioNombre, cambios } = envelope.payload as PedidoActualizadoPayload;
      if (!cambios?.length) return;
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
}
