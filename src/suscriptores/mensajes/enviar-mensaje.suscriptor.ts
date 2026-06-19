import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import { publicadorEventos } from "@/shared/rabbitmq/publicador";
import { EventosSistema } from "@/eventos/catalogo";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoEnviarMensajePayload } from "@/eventos/contratos/enviar-mensaje.comando";
import { prisma } from "@/shared/db/prisma";
import { obtenerProvider } from "@/conversaciones/providers/registry";
import { resolverUrlMedia } from "@/lib/resolve-media-url";

export class EnviarMensajeSuscriptor extends ConsumidorBase {
  readonly queue = QUEUES.MENSAJE_ENVIAR;
  readonly routingKeys = [RK.COMANDO_MENSAJE_ENVIAR];

  async manejar(envelope: EventoEnvelope<ComandoEnviarMensajePayload>): Promise<void> {
    const { instanciaId, payload } = envelope;
    const { mensajeId, conversacionId, cuentaCanalId, contenido, tipo, destinatario } = payload;
    const mediaUrl = resolverUrlMedia(payload.mediaUrl);

    const cuentaCanal = await prisma.cuentaCanal.findUniqueOrThrow({ where: { id: cuentaCanalId } });
    const provider = obtenerProvider(cuentaCanal.canal);

    if (!provider) {
      throw new Error(`[EnviarMensaje] No hay provider para canal "${cuentaCanal.canal}"`);
    }

    console.log(`[EnviarMensaje] Enviando por ${cuentaCanal.canal} → ${destinatario}${mediaUrl ? ` | media: ${mediaUrl}` : ""}`);
    const result = await provider.enviarMensaje({
      destinatario,
      contenido: contenido ?? "",
      tipo: tipo as Parameters<typeof provider.enviarMensaje>[0]["tipo"],
      configuracion: cuentaCanal.configuracion as Record<string, unknown>,
      mediaUrl,
    });
    console.log(`[EnviarMensaje] Enviado OK → idExterno: ${result.idExterno}`);

    await prisma.mensajeConversacion.update({
      where: { id: mensajeId },
      data: { estado: "ENTREGADO", idExterno: result.idExterno, enviadoEn: new Date() },
    });

    void publicadorEventos.publicar(EventosSistema.MensajeEnviado, instanciaId, {
      mensajeId,
      conversacionId,
      instanciaId,
    });
  }
}
