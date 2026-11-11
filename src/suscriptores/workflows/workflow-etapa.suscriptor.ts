import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { OportunidadMovidaDeEtapaPayload } from "@/eventos/contratos/oportunidad-movida-de-etapa.event";

// Al entrar una oportunidad a una etapa: cancela lo pendiente de la etapa
// anterior (D5) e inicia el Workflow asignado a la nueva. Si este evento se
// pierde, el ciclo del worker lo procesa igual desde OportunidadHistorialEtapa.
export class WorkflowEtapaSuscriptor extends ConsumidorBase<OportunidadMovidaDeEtapaPayload & Record<string, unknown>> {
  readonly queue = QUEUES.WORKFLOW_ETAPA;
  readonly routingKeys = [RK.EVENTO_OPORTUNIDAD_MOVIDA_DE_ETAPA];

  async manejar(envelope: EventoEnvelope<OportunidadMovidaDeEtapaPayload & Record<string, unknown>>): Promise<void> {
    const { procesarMovimientoEtapa } = await import("@/workflows/motor/disparo");
    await procesarMovimientoEtapa(envelope.payload.historialId);
  }
}
