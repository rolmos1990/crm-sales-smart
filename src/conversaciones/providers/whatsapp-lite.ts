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

    if (sessionId) {
      try {
        // El sesionManagerWA vive en el proceso Node.js — import directo (no se bundlea con webpack)
        const { sesionManagerWA } = await import("@/integraciones/whatsapp-lite/sesion-manager");
        const sesion = sesionManagerWA.obtener(sessionId);

        if (sesion?.socket && sesion.estado === "conectado") {
          // WhatsApp JID: dígitos sin '+' + @s.whatsapp.net
          const telefono = payload.destinatario.replace(/\D/g, "");
          const jid = `${telefono}@s.whatsapp.net`;
          const result = await sesion.socket.sendMessage(jid, { text: payload.contenido });
          return { idExterno: result?.key?.id ?? `wl_${Date.now()}` };
        } else {
          console.warn("[WhatsAppLite] Socket no disponible para sessionId", sessionId, "— mensaje guardado pero no enviado por WA");
        }
      } catch (e) {
        console.error("[WhatsAppLite] Error al enviar:", e);
      }
    }

    // Fallback: el mensaje se guarda en DB pero no se envió por WhatsApp
    return { idExterno: `wl_${Date.now()}` };
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
