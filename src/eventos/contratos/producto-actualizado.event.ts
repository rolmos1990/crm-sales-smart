export interface ProductoActualizadoPayload {
  instanciaId: string;
  productoId: string;
  cambios: Record<string, unknown>;
}
