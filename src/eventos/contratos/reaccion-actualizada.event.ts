export interface ReaccionActualizadaPayload extends Record<string, unknown> {
  mensajeId: string;
  conversacionId: string;
  instanciaId: string;
}
