export interface MensajeEnviadoPayload extends Record<string, unknown> {
  mensajeId: string;
  conversacionId: string;
  instanciaId: string;
}
