export interface PedidoCreadoPayload extends Record<string, unknown> {
  instanciaId: string;
  pedidoId: string;
  numero: string;
  total: number;
  usuarioId: string | null;
  usuarioNombre: string | null;
}
