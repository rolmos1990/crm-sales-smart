import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import { manejadorSSE } from "@/shared/eventos/sse";

export class SSERelaySuscriptor extends ConsumidorBase {
  readonly queue = QUEUES.SSE;
  readonly routingKeys = [
    RK.EVENTO_CONVERSACION_CREADA,
    RK.EVENTO_MENSAJE_RECIBIDO,
    RK.EVENTO_MENSAJE_ENVIADO,
    RK.EVENTO_REACCION_ACTUALIZADA,
  ];

  async manejar(envelope: EventoEnvelope): Promise<void> {
    const { instanciaId, tipo, payload } = envelope;
    manejadorSSE.emitir(instanciaId, tipo, payload);
  }
}
