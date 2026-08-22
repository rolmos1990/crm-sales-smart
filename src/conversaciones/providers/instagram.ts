import type { ICanalProvider, CapacidadCanal, MensajeSalientePayload, ReaccionCanalPayload } from "./types";
import type { MensajeEntranteNormalizado, TipoMensaje } from "../types";
import { resolverApiBaseIG } from "./instagram-estrategia-auth";
import { EnvioMensajeError } from "../errores";

// Forma del error que devuelve la Graph API de Meta — ver
// https://developers.facebook.com/docs/graph-api/guides/error-handling.
// El texto de `message` viene en el idioma de la cuenta (en producción
// llegó en finés para el mismo error "fuera de ventana"), así que la
// clasificación de abajo se apoya en `code`/`error_subcode` (estables,
// numéricos), nunca en el texto.
interface ErrorMetaGraphAPI {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

// code 10, subcode 2534022: la ventana de 24h/7d ya venció — confirmado
// contra un error real de producción ("Tämä viesti on lähetetty sallitun
// ikkunan ulkopuolella" = "outside allowed window").
const IG_SUBCODE_FUERA_VENTANA = 2534022;
// code 190: access token inválido/vencido (estándar de Graph API, no
// específico de mensajería).
const IG_CODE_TOKEN_INVALIDO = 190;

/** Clasifica un error de la Graph API de Instagram en un DetalleErrorEnvio
 *  — decide si conviene reintentar o no. `usoTagHumanAgent` es el tag con
 *  el que se armó la request que Meta está rechazando: un code 10 en una
 *  request CON tag HUMAN_AGENT (que no sea la ventana vencida, subcode
 *  distinto de 2534022) es casi siempre "la app no tiene esa capability
 *  aprobada" — Meta no expone un subcode propio y estable para esto, así
 *  que se infiere del contexto de la request en vez de parsear el texto
 *  (localizado) del mensaje. Exportada para poder testearla sin pegarle a
 *  la red — ver instagram.test.ts. */
export function clasificarErrorInstagram(
  httpStatus: number | null,
  body: ErrorMetaGraphAPI,
  usoTagHumanAgent: boolean
): EnvioMensajeError {
  const meta = body.error;
  const metaCode = meta?.code;
  const metaSubcode = meta?.error_subcode;

  if (httpStatus === 429) {
    return new EnvioMensajeError({
      codigo: "RATE_LIMIT",
      mensaje: "Instagram está limitando la cantidad de mensajes en este momento — se reintentará.",
      reintentable: true,
      metaCode, metaSubcode, httpStatus,
    });
  }

  if (httpStatus !== null && httpStatus >= 500) {
    return new EnvioMensajeError({
      codigo: "ERROR_TEMPORAL_META",
      mensaje: "Instagram tuvo un error temporal al recibir el mensaje — se reintentará.",
      reintentable: true,
      metaCode, metaSubcode, httpStatus,
    });
  }

  if (metaCode === IG_CODE_TOKEN_INVALIDO) {
    return new EnvioMensajeError({
      codigo: "TOKEN_INVALIDO",
      mensaje: "El token de acceso de esta cuenta de Instagram es inválido o venció — hay que reconectar la integración.",
      reintentable: false,
      metaCode, metaSubcode, httpStatus: httpStatus ?? undefined,
    });
  }

  if (metaCode === 10) {
    if (metaSubcode === IG_SUBCODE_FUERA_VENTANA) {
      return new EnvioMensajeError({
        codigo: "FUERA_VENTANA_MENSAJERIA",
        mensaje: "La ventana de mensajería de Instagram para este contacto ya venció.",
        reintentable: false,
        metaCode, metaSubcode, httpStatus: httpStatus ?? undefined,
      });
    }
    if (usoTagHumanAgent) {
      return new EnvioMensajeError({
        codigo: "HUMAN_AGENT_NO_APROBADO",
        mensaje: "La ventana estándar de 24h de Instagram expiró y esta integración no tiene habilitada la extensión para agentes humanos.",
        reintentable: false,
        metaCode, metaSubcode, httpStatus: httpStatus ?? undefined,
      });
    }
    return new EnvioMensajeError({
      codigo: "PERMISO_DENEGADO_META",
      mensaje: "Instagram rechazó el envío por un permiso no habilitado en la integración.",
      reintentable: false,
      metaCode, metaSubcode, httpStatus: httpStatus ?? undefined,
    });
  }

  // Error desconocido/sin clasificar — conservador: se mantiene la
  // estrategia actual (reintentar) en vez de arriesgarse a descartar un
  // mensaje que en realidad era recuperable.
  return new EnvioMensajeError({
    codigo: "ERROR_DESCONOCIDO_META",
    mensaje: meta?.message ?? "Instagram devolvió un error al enviar el mensaje.",
    reintentable: true,
    metaCode, metaSubcode, httpStatus: httpStatus ?? undefined,
  });
}

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

    console.log(`[Instagram] enviarMensaje → destinatario: ${payload.destinatario}${payload.tag ? ` | tag: ${payload.tag}` : ""}`);

    // El tag (hoy solo HUMAN_AGENT) lo decide quien arma el payload
    // (EnviarMensajeSuscriptor, según la ventana de mensajería — ver
    // instagram-ventana.ts) — este provider no calcula ninguna ventana, solo
    // lo traduce al request de Meta: sin tag, RESPONSE normal (dentro de
    // las 24h); con tag, MESSAGE_TAG (extiende a 7 días si la integración
    // tiene la capability aprobada — si no, Meta responde code 10 y
    // clasificarErrorInstagram() lo marca HUMAN_AGENT_NO_APROBADO).
    let res: Response;
    try {
      res = await fetch(`${IG_API}/${instagramBusinessAccountId}/messages`, {
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
      // fetch() tiró antes de llegar a tener una respuesta — timeout, DNS,
      // conexión caída, etc.: siempre transitorio.
      throw new EnvioMensajeError({
        codigo: "ERROR_RED",
        mensaje: "No se pudo contactar a Instagram — se reintentará.",
        reintentable: true,
      });
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as ErrorMetaGraphAPI;
      throw clasificarErrorInstagram(res.status, body, payload.tag === "HUMAN_AGENT");
    }

    const data = await res.json() as { message_id?: string };
    const idExterno = data.message_id;

    if (!idExterno) {
      // 200 OK sin message_id no debería pasar — forma de respuesta
      // inesperada, no un rechazo de Meta. Conservador: reintentable.
      throw new EnvioMensajeError({
        codigo: "RESPUESTA_INESPERADA",
        mensaje: "Instagram no devolvió un id de mensaje.",
        reintentable: true,
        httpStatus: res.status,
      });
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
