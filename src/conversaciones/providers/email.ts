import type { ICanalProvider, CapacidadCanal, MensajeSalientePayload } from "./types";
import type { MensajeEntranteNormalizado } from "../types";

export class EmailProvider implements ICanalProvider {
  readonly canal = "email";
  readonly capacidades: CapacidadCanal = {
    texto: true,
    imagen: true,
    video: false,
    audio: false,
    notaVoz: false,
    documento: true,
    plantillas: true,
    botones: false,
    marcarLeidoExterno: false,
    reacciones: false,
  };

  async enviarMensaje(payload: MensajeSalientePayload): Promise<{ idExterno: string }> {
    // TODO: integrar con proveedor de email (Resend, SendGrid, etc.)
    console.log("[Email] enviarMensaje", payload);
    return { idExterno: `email_${Date.now()}` };
  }

  mapearEntrante(raw: unknown): MensajeEntranteNormalizado {
    const data = raw as Record<string, unknown>;
    return {
      canal: this.canal,
      identificadorContacto: String(data.from ?? ""),
      cuentaCanalId: String(data.cuentaCanalId ?? ""),
      contenido: data.text ? String(data.text) : undefined,
      tipo: "TEXTO",
      idExterno: data.messageId ? String(data.messageId) : undefined,
    };
  }

  validarWebhook(_req: Request): boolean {
    return true;
  }
}
