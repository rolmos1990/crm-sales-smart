import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoGenerarRespuestaIAPayload } from "@/eventos/contratos/generar-respuesta-ia.comando";

// Envoltorio de cola: toda la lógica vive en responderConAgente
// (src/ai/respuesta/responder-con-agente.ts), compartida con el nodo
// "Atención IA" de los Workflows.
export class GenerarRespuestaIASuscriptor extends ConsumidorBase<ComandoGenerarRespuestaIAPayload> {
  readonly queue = QUEUES.AI_RESPUESTA;
  readonly routingKeys = [RK.COMANDO_AI_GENERAR_RESPUESTA];

  async manejar(envelope: EventoEnvelope<ComandoGenerarRespuestaIAPayload>): Promise<void> {
    const { conversacionId, instanciaId, agenteIAConfigId } = envelope.payload;
    const { responderConAgente } = await import("@/ai/respuesta/responder-con-agente");
    await responderConAgente({ conversacionId, instanciaId, agenteIAConfigId });
  }
}
