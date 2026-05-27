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
    // TODO: integrar con API de WhatsApp Lite
    console.log("[WhatsAppLite] enviarMensaje", payload);
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

  validarWebhook(req: Request): boolean {
    // TODO: validar token/firma del webhook
    return true;
  }
}
