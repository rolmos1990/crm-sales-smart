import type { ICanalProvider, CapacidadCanal, MensajeSalientePayload } from "./types";
import type { MensajeEntranteNormalizado } from "../types";

export class WhatsAppLiteProvider implements ICanalProvider {
  readonly canal = "whatsapp_lite";
  readonly capacidades: CapacidadCanal = {
    texto: true,
    imagen: true,
    video: true,
    audio: true,
    notaVoz: true,
    documento: true,
    plantillas: false,
    botones: false,
  };

  async enviarMensaje(payload: MensajeSalientePayload): Promise<{ idExterno: string }> {
    const configuracion = payload.configuracion as { sessionId?: string } | null;
    const sessionId = configuracion?.sessionId;

    if (!sessionId) {
      throw new Error("[WhatsAppLite] sessionId no configurado en la cuenta canal");
    }

    const { sesionManagerWA } = await import("@/integraciones/whatsapp-lite/sesion-manager");
    const sesion = sesionManagerWA.obtener(sessionId);

    if (!sesion?.socket || sesion.estado !== "conectado") {
      throw new Error(`[WhatsAppLite] Sesión no conectada (sessionId: ${sessionId}, estado: ${sesion?.estado ?? "sin sesión"})`);
    }

    // Construir el JID de destino según el formato del identificador:
    // - Si ya viene con sufijo @lid o @s.whatsapp.net → usarlo directamente (contactos con privacidad activada)
    // - Si es un número de teléfono → normalizar y añadir @s.whatsapp.net
    let jid: string;
    if (
      payload.destinatario.endsWith("@lid") ||
      payload.destinatario.endsWith("@s.whatsapp.net")
    ) {
      jid = payload.destinatario;
    } else {
      const telefono = payload.destinatario.replace(/\D/g, "");
      if (!telefono) throw new Error(`[WhatsAppLite] Destinatario inválido: "${payload.destinatario}"`);
      jid = `${telefono}@s.whatsapp.net`;
    }
    const { mediaUrl, contenido, tipo } = payload;

    console.log(`[WhatsAppLite] sendMessage → jid: ${jid} | tipo: ${tipo}${mediaUrl ? ` | media: ${mediaUrl}` : ""}`);

    // WAMessage de Baileys tiene key.id: string | null | undefined
    let result: { key?: { id?: string | null } } | undefined;

    if (mediaUrl) {
      // Mensaje con media — seleccionar tipo Baileys según TipoMensaje
      switch (tipo) {
        case "IMAGEN":
          result = await sesion.socket.sendMessage(jid, {
            image: { url: mediaUrl },
            caption: contenido || undefined,
          });
          break;

        case "VIDEO":
          result = await sesion.socket.sendMessage(jid, {
            video: { url: mediaUrl },
            caption: contenido || undefined,
          });
          break;

        case "AUDIO":
          result = await sesion.socket.sendMessage(jid, {
            audio: { url: mediaUrl },
            mimetype: payload.mediaMimeType ?? "audio/mpeg",
            ptt: false,
          });
          break;

        case "NOTA_VOZ":
          result = await sesion.socket.sendMessage(jid, {
            audio: { url: mediaUrl },
            mimetype: payload.mediaMimeType ?? "audio/ogg; codecs=opus",
            ptt: true,
          });
          break;

        case "DOCUMENTO":
          result = await sesion.socket.sendMessage(jid, {
            document: { url: mediaUrl },
            mimetype: payload.mediaMimeType ?? "application/octet-stream",
            fileName: "archivo",
            caption: contenido || undefined,
          });
          break;

        default:
          // Tipo desconocido con media → intentar como imagen
          result = await sesion.socket.sendMessage(jid, {
            image: { url: mediaUrl },
            caption: contenido || undefined,
          });
      }

      // Si también hay texto separado (caption ya incluido arriba, pero por si acaso)
    } else {
      // Mensaje de solo texto
      result = await sesion.socket.sendMessage(jid, {
        text: contenido ?? "",
      });
    }

    const idExterno = result?.key?.id ?? undefined;

    if (!idExterno) {
      // Lanzar error real para que el job quede FALLIDO (visible) en lugar de
      // COMPLETADO con un ID inventado que oculta el problema.
      throw new Error(
        `[WhatsAppLite] sendMessage no retornó key.id para ${jid}. ` +
        `Posible fallo de encriptación, contacto no alcanzable o sesión en estado inválido.`
      );
    }

    console.log(`[WhatsAppLite] Entregado → key.id: ${idExterno}`);
    return { idExterno };
  }

  mapearEntrante(raw: unknown): MensajeEntranteNormalizado {
    const data = raw as Record<string, unknown>;
    return {
      canal: this.canal,
      identificadorContacto: String(data.from ?? ""),
      cuentaCanalId: String(data.cuentaCanalId ?? ""),
      contenido: data.text ? String(data.text) : undefined,
      tipo: "TEXTO",
      idExterno: data.id ? String(data.id) : undefined,
    };
  }

  validarWebhook(_req: Request): boolean {
    return true;
  }
}
