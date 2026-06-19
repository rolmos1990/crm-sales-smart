export interface OportunidadActualizadaPayload {
  instanciaId: string;
  oportunidadId: string;
  cambios: Record<string, unknown>;
}
