export interface EmpresaActualizadaPayload {
  instanciaId: string;
  empresaId: string;
  cambios: Record<string, unknown>;
}
