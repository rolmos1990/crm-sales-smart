import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoProcesarMensajeAppNativaPayload } from "@/eventos/contratos/procesar-mensaje-app-nativa.comando";

// Mismo patrón que ProcesarEntranteSuscriptor — ver
// specs/020-fix-mensajes-app-nativa. Comando hermano, no una rama de
// PROCESAR_ENTRANTE: este mensaje no viene del contacto, así que no debe
// pasar por la orquestación de IA ni por la creación de oportunidades.
export class ProcesarMensajeAppNativaSuscriptor extends ConsumidorBase<ComandoProcesarMensajeAppNativaPayload> {
  readonly queue = QUEUES.MENSAJE_APP_NATIVA;
  readonly routingKeys = [RK.COMANDO_MENSAJE_APP_NATIVA];

  async manejar(envelope: EventoEnvelope<ComandoProcesarMensajeAppNativaPayload>): Promise<void> {
    const { payload } = envelope;
    const { registrarMensajeAppNativa } = await import("@/conversaciones/actions");
    await registrarMensajeAppNativa({
      canal: payload.canal,
      identificadorContacto: payload.identificadorContacto,
      cuentaCanalId: payload.cuentaCanalId,
      instanciaId: payload.instanciaId,
      contenido: payload.contenido,
      tipo: (payload.tipo ?? "TEXTO") as Parameters<typeof registrarMensajeAppNativa>[0]["tipo"],
      idExterno: payload.idExterno,
      pushName: payload.pushName,
      avatarUrl: payload.avatarUrl,
      handleCanal: payload.handleCanal,
      mediaUrl: payload.mediaUrl,
      mediaMimeType: payload.mediaMimeType,
      mediaDuracion: payload.mediaDuracion,
    });
  }
}
