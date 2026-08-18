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
}
