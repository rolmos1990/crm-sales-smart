// 026-preparacion-pedidos — se publica cuando una línea alcanza su cantidad
// completa. Los avances parciales no emiten evento.
export interface LineaPedidoPreparadaPayload extends Record<string, unknown> {
  instanciaId: string;
  pedidoId: string;
  numero: string;
  pedidoLineaId: string;
  productoId: string | null;
  cantidad: number;
  preparadaPorId: string | null;
}
