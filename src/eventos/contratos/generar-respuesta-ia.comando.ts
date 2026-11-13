export interface ComandoGenerarRespuestaIAPayload extends Record<string, unknown> {
  conversacionId: string;
  instanciaId: string;
  agenteIAConfigId?: string;
  /**
   * Mensaje del cliente que disparó este comando. Lo usa la ventana de espera
   * para descartarse si llegó otro mensaje después (ver ventana-espera.ts).
   * Opcional: un comando sin él nunca se descarta.
   */
  mensajeId?: string;
}
