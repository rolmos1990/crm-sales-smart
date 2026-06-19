export interface PedidoEntregadoPayload extends Record<string, unknown> {
  instanciaId: string;
  pedidoId: string;
  numero: string;
}
