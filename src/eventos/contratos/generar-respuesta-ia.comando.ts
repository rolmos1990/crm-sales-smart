export interface ComandoGenerarRespuestaIAPayload extends Record<string, unknown> {
  conversacionId: string;
  instanciaId: string;
  agenteIAConfigId?: string;
}
