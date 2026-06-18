import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoInicializarInstanciaPayload } from "@/shared/eventos/registro";
import { crearPipelineDefault } from "@/shared/inicializacion/pipeline-default";

export class InicializarInstanciaSuscriptor extends ConsumidorBase {
  readonly queue = QUEUES.SISTEMA_INICIALIZAR;
  readonly routingKeys = [RK.COMANDO_SISTEMA_INICIALIZAR];

  async manejar(envelope: EventoEnvelope<ComandoInicializarInstanciaPayload>): Promise<void> {
    const { instanciaId } = envelope.payload;
    console.log(`[InicializarInstancia] instanciaId: ${instanciaId}`);
    await crearPipelineDefault(instanciaId);
  }
}
