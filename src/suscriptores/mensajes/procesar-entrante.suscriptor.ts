import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoProcesarEntrantePayload } from "@/shared/eventos/registro";

export class ProcesarEntranteSuscriptor extends ConsumidorBase {
  readonly queue = QUEUES.MENSAJE_ENTRANTE;
  readonly routingKeys = [RK.COMANDO_MENSAJE_ENTRANTE];

  async manejar(envelope: EventoEnvelope<ComandoProcesarEntrantePayload>): Promise<void> {
    const { payload } = envelope;
    const { procesarMensajeEntrante } = await import("@/conversaciones/actions");
    await procesarMensajeEntrante({
      canal: payload.canal,
      identificadorContacto: payload.identificadorContacto,
      cuentaCanalId: payload.cuentaCanalId,
      instanciaId: payload.instanciaId,
      contenido: payload.contenido,
      tipo: (payload.tipo ?? "TEXTO") as Parameters<typeof procesarMensajeEntrante>[0]["tipo"],
      idExterno: payload.idExterno,
      pushName: payload.pushName,
      avatarUrl: payload.avatarUrl,
      mediaUrl: payload.mediaUrl,
      mediaMimeType: payload.mediaMimeType,
      mediaDuracion: payload.mediaDuracion,
    });
  }
}
