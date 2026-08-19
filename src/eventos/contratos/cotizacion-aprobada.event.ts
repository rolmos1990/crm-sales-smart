// Se publica apenas la cotización cambia a estado APROBADA — ANTES de que el
// pedido exista. El nombre evita "CotizacionPedidoGenerado" a propósito: ese
// nombre implicaría que el pedido ya fue creado, y en este punto todavía no.
// El manejador único de este evento (CotizacionAprobadaSuscriptor) es quien
// efectivamente genera el pedido, de forma idempotente.
export interface CotizacionAprobadaPayload extends Record<string, unknown> {
  instanciaId: string;
  cotizacionId: string;
  numero: string;
  usuarioId?: string | null;
}
