import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoProcesarEntrantePayload } from "@/eventos/contratos/procesar-entrante.comando";

export class ProcesarEntranteSuscriptor extends ConsumidorBase<ComandoProcesarEntrantePayload> {
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
      handleCanal: payload.handleCanal,
      mediaUrl: payload.mediaUrl,
      mediaMimeType: payload.mediaMimeType,
      mediaDuracion: payload.mediaDuracion,
      // 049 — Sin esto el FK al MediaArchivo quedaba NULL siempre: el webhook
      // lo produce y el contrato lo declara, pero este suscriptor copia campo
      // por campo y lo descartaba. Dejaba el archivo sin vincular al contacto
      // y sin forma de colgarle la transcripción.
      mediaArchivoId: payload.mediaArchivoId,
      asunto: payload.asunto,
      hiloExterno: payload.hiloExterno,
      // 035 — Solo correo. Sin esto el HTML limpio y las cabeceras se perderían
      // en silencio: este suscriptor copia campo por campo.
      correo: payload.correo,
    });
    // La orquestación IA se maneja en OrquestarIASuscriptor (escucha MensajeRecibido)
  }
}
