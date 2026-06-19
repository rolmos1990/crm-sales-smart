export interface ComandoEnviarMensajePayload extends Record<string, unknown> {
  instanciaId: string;
  mensajeId: string;
  conversacionId: string;
  cuentaCanalId: string;
  tipo: string;
  destinatario: string;
  contenido?: string;
  mediaUrl?: string;
}
