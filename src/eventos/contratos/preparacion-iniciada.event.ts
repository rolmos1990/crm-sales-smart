// 026-preparacion-pedidos — se publica una sola vez por preparación, cuando se
// sella `iniciadaEn`. Retroceder y volver a avanzar NO lo re-emite, porque el
// inicio es el primero, no el último.
export interface PreparacionIniciadaPayload extends Record<string, unknown> {
  instanciaId: string;
  pedidoId: string;
  numero: string;
  estadoId: string;
  estadoNombre: string;
  iniciadaEn: string;
  usuarioId: string | null;
}
