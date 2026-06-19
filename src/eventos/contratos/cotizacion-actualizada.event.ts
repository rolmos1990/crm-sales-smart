export interface CotizacionActualizadaPayload {
  instanciaId: string;
  cotizacionId: string;
  cambios: Record<string, unknown>;
}
