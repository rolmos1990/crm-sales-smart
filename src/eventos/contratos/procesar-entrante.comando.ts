import type { DatosCorreoEntrante } from "@/integraciones/email/vista/schema";

export interface ComandoProcesarEntrantePayload extends Record<string, unknown> {
  instanciaId: string;
  canal: string;
  identificadorContacto: string;
  cuentaCanalId: string;
  contenido?: string;
  tipo: string;
  idExterno?: string;
  pushName?: string;
  avatarUrl?: string;
  handleCanal?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaDuracion?: number;
  mediaArchivoId?: string;
  /** 034 — Solo canal "email". Campos opcionales: los canales que ya existían
   *  no los mandan y el consumidor los ignora si faltan. */
  asunto?: string;
  hiloExterno?: string;
  /** 035 — Solo canal "email": HTML YA LIMPIO (nunca el original), cabeceras
   *  y adjuntos del correo. Opcional por el mismo motivo que `asunto`; el
   *  consumidor lo valida con Zod antes de guardarlo. */
  correo?: DatosCorreoEntrante;
}
