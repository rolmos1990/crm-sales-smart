export interface ContactoActualizadoPayload {
  instanciaId: string;
  contactoId: string;
  cambios: Record<string, unknown>;
}
