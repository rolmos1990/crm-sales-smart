import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import { publicadorEventos } from "@/shared/rabbitmq/publicador";
import { EventosSistema } from "@/eventos/catalogo";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoEnviarMensajePayload } from "@/eventos/contratos/enviar-mensaje.comando";
import { prisma } from "@/shared/db/prisma";
import { obtenerProvider } from "@/conversaciones/providers/registry";
import { resolverUrlMedia } from "@/lib/resolve-media-url";
import { EnvioMensajeError } from "@/conversaciones/errores";
import { obtenerEstadoVentanaMensajeria } from "@/conversaciones/providers/instagram-ventana";

export class EnviarMensajeSuscriptor extends ConsumidorBase<ComandoEnviarMensajePayload> {
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

    // Ventana de mensajería — la exigen tanto Instagram como Facebook
    // Messenger (Meta rechaza con code 10 pasadas las 24h sin tag, y pasados
    // los 7 días ni con tag; es la misma política del Messenger Platform
    // para ambos productos — ver specs/005-facebook-messenger-integracion/
    // research.md, R5). Se resuelve ACÁ (no en el provider, que no tiene
    // acceso a Prisma) y ANTES de llamar al provider. La capability "Human
    // Agent" ya está aprobada por Meta para esta app, así que entre 24h y 7
    // días se manda el tag directo — solo se corta local cuando ya pasaron
    // los 7 días, caso en el que Meta rechazaría con o sin tag.
    let tag: "HUMAN_AGENT" | undefined;
    if (cuentaCanal.canal === "instagram" || cuentaCanal.canal === "facebook_messenger") {
      const ultimoDelContacto = await prisma.mensajeConversacion.findFirst({
        where: { conversacionId, remitente: "CONTACTO" },
        orderBy: { creadoEn: "desc" },
        select: { creadoEn: true },
      });
      const estadoVentana = obtenerEstadoVentanaMensajeria(ultimoDelContacto?.creadoEn ?? null);

      if (estadoVentana === "FUERA_DE_VENTANA") {
        throw new EnvioMensajeError({
          codigo: "FUERA_VENTANA_MENSAJERIA",
          mensaje: "La ventana de mensajería de Instagram para este contacto ya venció (más de 7 días desde su último mensaje).",
          reintentable: false,
        });
      }
      if (estadoVentana === "HUMAN_AGENT") {
        tag = "HUMAN_AGENT";
      }
      // VENTANA_NORMAL → tag queda undefined, envío normal (sin tag).
    }

    console.log(`[EnviarMensaje] Enviando por ${cuentaCanal.canal} → ${destinatario}${mediaUrl ? ` | media: ${mediaUrl}` : ""}${tag ? ` | tag: ${tag}` : ""}`);

    let result: { idExterno: string };
    try {
      result = await provider.enviarMensaje({
        destinatario,
        contenido: contenido ?? "",
        tipo: tipo as Parameters<typeof provider.enviarMensaje>[0]["tipo"],
        // proveedorAuth vive en la columna de CuentaCanal (no en el JSON de
        // configuracion) — se mezcla acá para que el provider de Instagram
        // pueda elegir el host de Graph API correcto sin que cada canal tenga
        // que saber de esta diferencia. Ver instagram-estrategia-auth.ts.
        configuracion: { ...(cuentaCanal.configuracion as Record<string, unknown>), proveedorAuth: cuentaCanal.proveedorAuth },
        mediaUrl,
        tag,
      });
    } catch (err) {
      // Log estructurado (sin tokens/credenciales) — ConsumidorBase ya loguea
      // el intento/eventId/tipo genérico; esto suma el detalle específico de
      // mensajería que esa capa no conoce (mensajeId, conversationId).
      const detalle = err instanceof EnvioMensajeError ? err : null;
      console.error("[EnviarMensaje] Fallo de envío", {
        provider: cuentaCanal.canal,
        eventId: envelope.eventId,
        conversationId: conversacionId,
        messageId: mensajeId,
        errorCode: detalle?.codigo ?? "ERROR_DESCONOCIDO",
        metaCode: detalle?.metaCode,
        metaSubcode: detalle?.metaSubcode,
        retryable: detalle?.reintentable ?? true,
      });
      throw err;
    }
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

  // Se llama tanto al agotar los MAX_INTENTOS de ConsumidorBase (error
  // transitorio que nunca se recuperó) como de inmediato, en el primer
  // intento, cuando el error se clasificó como no reintentable (ver
  // EnvioMensajeError — token vencido, ventana cerrada, HUMAN_AGENT no
  // aprobado). En ambos casos el mensaje queda definitivamente sin
  // entregar — sin esto quedaba en ENVIADO para siempre (dead-letter
  // queue crm.muertos, sin consumidor). Reutiliza el evento MensajeEnviado
  // para avisarle al frontend — panel-conversacion.tsx solo lo usa como
  // señal de "volvé a pedir los mensajes", no le importa el nombre ni el
  // payload más allá de eso.
  protected async alAgotarReintentos(
    envelope: EventoEnvelope<ComandoEnviarMensajePayload>,
    error: unknown
  ): Promise<void> {
    const { instanciaId, payload } = envelope;
    const { mensajeId, conversacionId } = payload;
    const detalle = error instanceof EnvioMensajeError ? error : null;
    await prisma.mensajeConversacion.update({
      where: { id: mensajeId },
      data: {
        estado: "FALLIDO",
        codigoError: detalle?.codigo ?? "ERROR_DESCONOCIDO",
        motivoError: detalle?.message ?? (error instanceof Error ? error.message : String(error)),
        fechaError: new Date(),
      },
    });
    void publicadorEventos.publicar(EventosSistema.MensajeEnviado, instanciaId, {
      mensajeId,
      conversacionId,
      instanciaId,
    });
  }
}
