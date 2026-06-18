import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoMarcarLeidoPayload } from "@/shared/eventos/registro";
import { prisma } from "@/shared/db/prisma";
import { obtenerProvider } from "@/conversaciones/providers/registry";

export class MarcarLeidoSuscriptor extends ConsumidorBase {
  readonly queue = QUEUES.MENSAJE_LEIDO;
  readonly routingKeys = [RK.COMANDO_MENSAJE_LEIDO];

  async manejar(envelope: EventoEnvelope<ComandoMarcarLeidoPayload>): Promise<void> {
    const { mensajeIds, conversacionId } = envelope.payload;

    const mensajes = await prisma.mensajeConversacion.findMany({
      where: { id: { in: mensajeIds }, conversacionId },
      include: {
        conversacion: {
          include: {
            cuentaCanal: true,
            contacto: { include: { identificadoresCanal: true } },
          },
        },
      },
    });

    const conv = mensajes[0]?.conversacion;
    if (!conv?.cuentaCanal) return;

    const provider = obtenerProvider(conv.cuentaCanal.canal);
    if (!provider?.marcarLeido) return;

    const canal = conv.cuentaCanal.canal;
    const identificadorContacto =
      conv.contacto.identificadoresCanal.find((i) => i.canal === canal)?.identificador ?? "";

    const payloads = mensajes
      .filter((m) => !!m.idExterno)
      .map((m) => ({ idExterno: m.idExterno!, identificadorContacto }));

    if (payloads.length > 0) {
      await provider.marcarLeido(payloads, conv.cuentaCanal.configuracion as Record<string, unknown>);
    }
  }
}
