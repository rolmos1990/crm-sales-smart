import type { ICanalProvider, CapacidadCanal, MensajeSalientePayload, ReaccionCanalPayload } from "./types";
import type { MensajeEntranteNormalizado, TipoMensaje } from "../types";
import { resolverApiBaseIG } from "./instagram-estrategia-auth";

export class InstagramProvider implements ICanalProvider {
  readonly canal = "instagram";
  readonly capacidades: CapacidadCanal = {
    texto: true,
    imagen: true,
    video: true,
    audio: false,
    notaVoz: false,
    documento: false,
    plantillas: false,
    botones: false,
    marcarLeidoExterno: false,
    reacciones: true,
  };

  async enviarMensaje(payload: MensajeSalientePayload): Promise<{ idExterno: string }> {
    const cfg = payload.configuracion as {
      accessToken?: string;
      instagramBusinessAccountId?: string;
      proveedorAuth?: string;
    };
    const { accessToken, instagramBusinessAccountId } = cfg;

    if (!accessToken || !instagramBusinessAccountId) {
      throw new Error("[Instagram] accessToken e instagramBusinessAccountId requeridos en configuracion");
    }

    // Host base según el flujo con el que se conectó la cuenta — ver
    // instagram-estrategia-auth.ts. El resto del envío es idéntico entre
    // proveedores (mismo path, mismo body, Bearer token).
    const IG_API = resolverApiBaseIG(cfg.proveedorAuth);

    let messageBody: Record<string, unknown>;

    if (payload.mediaUrl) {
      const tipoAdjunto: Record<string, string> = {
        IMAGEN: "image",
        VIDEO: "video",
      };
      const adjunto = tipoAdjunto[payload.tipo];
      if (adjunto) {
        messageBody = {
          attachment: { type: adjunto, payload: { url: payload.mediaUrl, is_reusable: true } },
        };
      } else {
        messageBody = { text: payload.contenido ?? "" };
      }
    } else {
      messageBody = { text: payload.contenido ?? "" };
    }

    console.log(`[Instagram] enviarMensaje → destinatario: ${payload.destinatario}`);

    const res = await fetch(`${IG_API}/${instagramBusinessAccountId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: payload.destinatario },
        message: messageBody,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[Instagram] Error al enviar mensaje: ${JSON.stringify(err)}`);
    }

    const data = await res.json() as { message_id?: string };
    const idExterno = data.message_id;

    if (!idExterno) {
      throw new Error("[Instagram] La API no retornó message_id");
    }

    console.log(`[Instagram] Enviado OK → message_id: ${idExterno}`);
    return { idExterno };
  }

  /**
   * Normaliza un evento individual de mensajería de Instagram.
   * El webhook handler extrae cada evento del batch y llama este método.
   * raw = { sender, recipient, timestamp, message, cuentaCanalId }
   */
  mapearEntrante(raw: unknown): MensajeEntranteNormalizado {
    const event = raw as {
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        is_echo?: boolean;
        attachments?: Array<{ type: string; payload: { url?: string; sticker_id?: number } }>;
      };
      cuentaCanalId: string;
    };

    const message = event.message;
    let contenido: string | undefined;
    let tipo: TipoMensaje = "TEXTO";
    let mediaUrl: string | undefined;

    if (message?.text) {
      contenido = message.text;
      tipo = "TEXTO";
    } else if (message?.attachments?.[0]) {
      const att = message.attachments[0];
      mediaUrl = att.payload?.url;
      switch (att.type) {
        case "image":  tipo = "IMAGEN"; break;
        case "video":  tipo = "VIDEO"; break;
        case "audio":  tipo = "AUDIO"; break;
        case "file":   tipo = "DOCUMENTO"; break;
        default:       tipo = "TEXTO"; break;
      }
    }

    return {
      canal: "instagram",
      identificadorContacto: event.sender.id,
      cuentaCanalId: event.cuentaCanalId,
      contenido,
      tipo,
      idExterno: message?.mid,
      mediaUrl,
    };
  }

  validarWebhook(_req: Request): boolean {
    // La validación se hace en el webhook dedicado /api/webhooks/instagram/route.ts
    return true;
  }

  /**
   * Reacciona (o quita la reacción) a un mensaje del contacto desde la cuenta
   * del negocio. Instagram sí soporta esto vía Graph API:
   * https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
   *   POST /{IG_ID}/messages
   *   { recipient: { id }, sender_action: "react" | "unreact", payload: { message_id, reaction? } }
   * Requiere permisos instagram_business_basic + instagram_business_manage_messages
   * (ya solicitados en el scope del login) y que el mensaje esté dentro de la
   * ventana de 24h de mensajería — fuera de ese margen Meta devuelve error y
   * simplemente queda la reacción visible solo en el CRM (no se relanza).
   */
  async enviarReaccion(payload: ReaccionCanalPayload): Promise<void> {
    const cfg = payload.configuracion as {
      accessToken?: string;
      instagramBusinessAccountId?: string;
      proveedorAuth?: string;
    };
    const { accessToken, instagramBusinessAccountId } = cfg;

    if (!accessToken || !instagramBusinessAccountId) {
      throw new Error("[Instagram] accessToken e instagramBusinessAccountId requeridos en configuracion");
    }

    const IG_API = resolverApiBaseIG(cfg.proveedorAuth);
    const quitar = payload.emoji === "";

    const body = {
      recipient: { id: payload.jid },
      sender_action: quitar ? "unreact" : "react",
      payload: {
        message_id: payload.idExternoMensaje,
        ...(quitar ? {} : { reaction: payload.emoji }),
      },
    };

    const res = await fetch(`${IG_API}/${instagramBusinessAccountId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[Instagram] Error al ${quitar ? "quitar" : "enviar"} reacción: ${JSON.stringify(err)}`);
    }

    console.log(`[Instagram] Reacción ${quitar ? "removida" : `"${payload.emoji}" enviada`} → msg: ${payload.idExternoMensaje}`);
  }
}
