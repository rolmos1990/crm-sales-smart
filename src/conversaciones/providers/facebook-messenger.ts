import type { ICanalProvider, CapacidadCanal, MensajeSalientePayload, ReaccionCanalPayload } from "./types";
import type { MensajeEntranteNormalizado, TipoMensaje } from "../types";
import { clasificarErrorInstagram } from "./instagram";
import { EnvioMensajeError } from "../errores";
import { descifrarToken } from "@/shared/lib/cifrado-tokens";

// Graph API de Facebook — Messenger no tiene el doble host que sí tiene
// Instagram (Instagram Login vs Facebook Login): una Página siempre se
// autentica y se usa vía graph.facebook.com. Revisar
// https://developers.facebook.com/docs/graph-api/changelog antes de subir
// de versión — debería mantenerse alineada con GRAPH_FACEBOOK_VERSION de
// instagram-estrategia-auth.ts, que cubre el mismo host para el flujo
// heredado de Instagram.
const GRAPH_FACEBOOK_VERSION = "v20.0";
const FB_API = `https://graph.facebook.com/${GRAPH_FACEBOOK_VERSION}`;

interface ErrorMetaGraphAPI {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export class FacebookMessengerProvider implements ICanalProvider {
  readonly canal = "facebook_messenger";
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

  /**
   * Envía un mensaje de texto o adjunto a un PSID (Page-Scoped ID) del
   * contacto. Misma forma de payload que `InstagramProvider.enviarMensaje`
   * (`POST /<PAGE_ID>/messages`) — Meta comparte el mismo Send API entre
   * Messenger e Instagram vía Página, ver
   * docs/META-INSTAGRAM-PRODUCTION-AUDIT.md y research.md (005) R4.
   */
  async enviarMensaje(payload: MensajeSalientePayload): Promise<{ idExterno: string }> {
    const cfg = payload.configuracion as {
      accessToken?: string;
      pageId?: string;
    };

    if (!cfg.accessToken || !cfg.pageId) {
      throw new Error("[FacebookMessenger] accessToken y pageId requeridos en configuracion");
    }
    const accessToken = descifrarToken(cfg.accessToken);

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

    console.log(`[FacebookMessenger] enviarMensaje → destinatario: ${payload.destinatario}${payload.tag ? ` | tag: ${payload.tag}` : ""}`);

    let res: Response;
    try {
      res = await fetch(`${FB_API}/${cfg.pageId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { id: payload.destinatario },
          message: messageBody,
          messaging_type: payload.tag ? "MESSAGE_TAG" : "RESPONSE",
          ...(payload.tag ? { tag: payload.tag } : {}),
        }),
      });
    } catch (err) {
      throw new EnvioMensajeError({
        codigo: "ERROR_RED",
        mensaje: "No se pudo contactar a Facebook — se reintentará.",
        reintentable: true,
      });
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as ErrorMetaGraphAPI;
      console.error("[FacebookMessenger] Meta rechazó el envío", {
        httpStatus: res.status,
        metaCode: body.error?.code,
        metaSubcode: body.error?.error_subcode,
        metaMessage: body.error?.message,
        fbtraceId: body.error?.fbtrace_id,
      });
      // Reutiliza el mismo clasificador que Instagram — es el mismo Send API
      // de Meta, con los mismos códigos de error (190, 10, 429, etc.). Ver
      // research.md (005) R4: evita duplicar ~70 líneas de clasificación por
      // un segundo canal que comparte contrato de errores con Instagram.
      throw clasificarErrorInstagram(res.status, body, payload.tag === "HUMAN_AGENT");
    }

    const data = (await res.json()) as { message_id?: string };
    const idExterno = data.message_id;

    if (!idExterno) {
      throw new EnvioMensajeError({
        codigo: "RESPUESTA_INESPERADA",
        mensaje: "Facebook no devolvió un id de mensaje.",
        reintentable: true,
        httpStatus: res.status,
      });
    }

    console.log(`[FacebookMessenger] Enviado OK → message_id: ${idExterno}`);
    return { idExterno };
  }

  /**
   * Normaliza un evento individual del webhook `messages` de la Página.
   * Misma forma que `InstagramProvider.mapearEntrante` (comparten
   * `messaging[]`) — el webhook handler ya resolvió que este evento
   * pertenece a Facebook Messenger, no a Instagram, antes de llamar acá
   * (ver research.md R1).
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
        attachments?: Array<{ type: string; payload: { url?: string } }>;
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
        case "image": tipo = "IMAGEN"; break;
        case "video": tipo = "VIDEO"; break;
        default:      tipo = "TEXTO"; break;
      }
    }

    return {
      canal: "facebook_messenger",
      identificadorContacto: event.sender.id,
      cuentaCanalId: event.cuentaCanalId,
      contenido,
      tipo,
      idExterno: message?.mid,
      mediaUrl,
    };
  }

  validarWebhook(_req: Request): boolean {
    // La validación real (firma X-Hub-Signature-256) vive en el webhook
    // compartido /api/webhooks/instagram/route.ts — mismo criterio que
    // InstagramProvider.validarWebhook.
    return true;
  }

  /**
   * Reacciona (o quita la reacción) a un mensaje del contacto desde la
   * Página. Mismo Send API que ya usa Instagram —
   * `POST /<PAGE_ID>/messages` con `sender_action: "react"|"unreact"` y
   * `payload.reaction` como emoji UTF-8 directo (confirmado contra la
   * documentación oficial de Meta, "Sender Actions" — ver
   * specs/008-fix-facebook-messenger-reacciones/research.md, R1).
   */
  async enviarReaccion(payload: ReaccionCanalPayload): Promise<void> {
    const cfg = payload.configuracion as {
      accessToken?: string;
      pageId?: string;
    };

    if (!cfg.accessToken || !cfg.pageId) {
      throw new Error("[FacebookMessenger] accessToken y pageId requeridos en configuracion");
    }
    const accessToken = descifrarToken(cfg.accessToken);

    const quitar = payload.emoji === "";

    const body = {
      recipient: { id: payload.jid },
      sender_action: quitar ? "unreact" : "react",
      payload: {
        message_id: payload.idExternoMensaje,
        ...(quitar ? {} : { reaction: payload.emoji }),
      },
    };

    const res = await fetch(`${FB_API}/${cfg.pageId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[FacebookMessenger] Error al ${quitar ? "quitar" : "enviar"} reacción: ${JSON.stringify(err)}`);
    }

    console.log(`[FacebookMessenger] Reacción ${quitar ? "removida" : `"${payload.emoji}" enviada`} → msg: ${payload.idExternoMensaje}`);
  }
}
