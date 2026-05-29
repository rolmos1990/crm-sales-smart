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

    // WhatsApp JID: solo dígitos del destinatario + @s.whatsapp.net
    const telefono = payload.destinatario.replace(/\D/g, "");
    if (!telefono) throw new Error(`[WhatsAppLite] Destinatario inválido: "${payload.destinatario}"`);

    const jid = `${telefono}@s.whatsapp.net`;
    console.log(`[WhatsAppLite] sendMessage → jid: ${jid} | contenido: "${payload.contenido}"`);

    const result = await sesion.socket.sendMessage(jid, { text: payload.contenido ?? "" });
    const idExterno = result?.key?.id;

    if (!idExterno) {
      console.warn(`[WhatsAppLite] sendMessage no devolvió key.id para jid ${jid} — posible fallo silencioso`);
    } else {
      console.log(`[WhatsAppLite] Entregado → key.id: ${idExterno}`);
    }

    return { idExterno: idExterno ?? `wl_${Date.now()}` };
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
