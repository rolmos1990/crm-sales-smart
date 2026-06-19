export interface EntradaHistorialPedido {
  accion: string;
  valorAnterior?: Record<string, unknown>;
  valorNuevo?: Record<string, unknown>;
}

export interface PedidoActualizadoPayload extends Record<string, unknown> {
  instanciaId: string;
  pedidoId: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  cambios: EntradaHistorialPedido[];
}
