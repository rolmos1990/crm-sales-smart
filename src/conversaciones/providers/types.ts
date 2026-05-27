import type { TipoMensaje, MensajeEntranteNormalizado } from "../types";

export interface CapacidadCanal {
  texto: boolean;
  imagen: boolean;
  video: boolean;
  audio: boolean;
  notaVoz: boolean;
  documento: boolean;
  plantillas: boolean;
  botones: boolean;
}

export interface MensajeSalientePayload {
  destinatario: string;     // número, email, userId externo
  contenido?: string;
  tipo: TipoMensaje;
  mediaUrl?: string;
  mediaMimeType?: string;
  plantillaId?: string;
  configuracion: Record<string, unknown>; // credenciales del CuentaCanal
}

export interface ICanalProvider {
  readonly canal: string;
  readonly capacidades: CapacidadCanal;
  enviarMensaje(payload: MensajeSalientePayload): Promise<{ idExterno: string }>;
  mapearEntrante(raw: unknown): MensajeEntranteNormalizado;
  validarWebhook(req: Request): boolean;
}
