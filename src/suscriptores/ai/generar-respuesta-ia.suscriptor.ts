import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoGenerarRespuestaIAPayload } from "@/eventos/contratos/generar-respuesta-ia.comando";

// Envoltorio de cola: toda la lógica vive en responderConAgente
// (src/ai/respuesta/responder-con-agente.ts), compartida con el nodo
// "Atención IA" de los Workflows.
//
// Acá sí vive la ventana de espera (ver ventana-espera.ts), y no dentro de
// responderConAgente, para que el nodo de Workflow conserve su propio control
// sobre cuándo responder.
export class GenerarRespuestaIASuscriptor extends ConsumidorBase<ComandoGenerarRespuestaIAPayload> {
  readonly queue = QUEUES.AI_RESPUESTA;
  readonly routingKeys = [RK.COMANDO_AI_GENERAR_RESPUESTA];

  async manejar(envelope: EventoEnvelope<ComandoGenerarRespuestaIAPayload>): Promise<void> {
    const { conversacionId, instanciaId, agenteIAConfigId, mensajeId } = envelope.payload;

    const { resolverMsEspera, esperar } = await import("@/ai/respuesta/ventana-espera");
    const { quedoObsoleto } = await import("@/ai/respuesta/ventana-espera.queries");
    const msEspera = await this.resolverEspera(instanciaId, agenteIAConfigId, resolverMsEspera);

    if (msEspera > 0) {
      await esperar(msEspera);

      // El cliente siguió escribiendo: responde el comando de su último
      // mensaje, con los de este tramo ya incluidos en el historial.
      if (await quedoObsoleto({ conversacionId, mensajeId })) {
        console.log(
          `[GenerarRespuestaIA] Descartado por mensaje más reciente — conversacion ${conversacionId}, mensaje ${mensajeId}`,
        );
        return;
      }
    }

    const { responderConAgente } = await import("@/ai/respuesta/responder-con-agente");
    await responderConAgente({ conversacionId, instanciaId, agenteIAConfigId });
  }

  private async resolverEspera(
    instanciaId: string,
    agenteIAConfigId: string | undefined,
    resolverMsEspera: typeof import("@/ai/respuesta/ventana-espera").resolverMsEspera,
  ): Promise<number> {
    const { prisma } = await import("@/shared/db/prisma");
    const seleccion = { esperarAntesDeResponder: true, segundosEsperaRespuesta: true } as const;

    const [agente, instancia] = await Promise.all([
      agenteIAConfigId
        ? prisma.agenteIAConfig.findUnique({ where: { id: agenteIAConfigId }, select: seleccion })
        : Promise.resolve(null),
      prisma.configuracionIA.findUnique({ where: { instanciaId }, select: seleccion }),
    ]);

    return resolverMsEspera(agente, instancia);
  }
}
