export interface MensajeRecibidoPayload extends Record<string, unknown> {
  mensajeId: string;
  conversacionId: string;
  instanciaId: string;
  oportunidadId?: string | null;
}
