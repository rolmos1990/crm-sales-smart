import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { CotizacionAprobadaPayload } from "@/eventos/contratos/cotizacion-aprobada.event";
import { generarPedidoDesdeCotizacion } from "@/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service";

/**
 * Único manejador que genera el Pedido cuando una cotización pasa a
 * APROBADA — sin importar si la aprobación se disparó desde el Workspace de
 * Oportunidades, el módulo de Cotizaciones, o cualquier otro lugar futuro.
 * Si falla (ej. condición de carrera de stock, error transitorio de DB), la
 * excepción se propaga y ConsumidorBase la registra + reintenta el mensaje
 * automáticamente (ver shared/rabbitmq/consumidor.ts).
 */
export class CotizacionAprobadaSuscriptor extends ConsumidorBase<CotizacionAprobadaPayload> {
  readonly queue = QUEUES.COTIZACION_APROBADA;
  readonly routingKeys = [RK.EVENTO_COTIZACION_APROBADA];

  async manejar(envelope: EventoEnvelope<CotizacionAprobadaPayload>): Promise<void> {
    const { instanciaId, cotizacionId, usuarioId } = envelope.payload;
    const resultado = await generarPedidoDesdeCotizacion(cotizacionId, instanciaId, usuarioId ?? null);
    if (resultado.yaExistia) {
      console.log(`[CotizacionAprobadaSuscriptor] Pedido ya existía para cotización ${cotizacionId} — sin duplicar (${resultado.numeroPedido})`);
    } else {
      console.log(`[CotizacionAprobadaSuscriptor] Pedido ${resultado.numeroPedido} generado desde cotización ${cotizacionId}`);
    }
  }
}
