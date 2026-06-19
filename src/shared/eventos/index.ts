export { TIPOS_EVENTO, TIPOS_COMANDO } from "./registro";
export type {
  EventoDominio,
  HandlerEvento,
  IBusEventos,
} from "./types";
export type {
  ContactoCreadoPayload,
  ContactoActualizadoPayload,
  ContactoEliminadoPayload,
  ContactoAsignadoPayload,
  EmpresaCreadaPayload,
  EmpresaActualizadaPayload,
  OportunidadCreadaPayload,
  OportunidadActualizadaPayload,
  EtapaCambiadaPayload,
  OportunidadGanadaPayload,
  OportunidadPerdidaPayload,
  ActividadCreadaPayload,
  ActividadCompletadaPayload,
  ProductoCreadoPayload,
  ProductoActualizadoPayload,
  PrecioActualizadoPayload,
  CotizacionCreadaPayload,
  CotizacionActualizadaPayload,
  CotizacionEnviadaPayload,
  PedidoCreadoPayload,
  PedidoActualizadoPayload,
  PedidoEntregadoPayload,
  EntradaHistorialPedido,
  MensajeRecibidoPayload,
  MensajeEnviadoPayload,
  ConversacionCreadaPayload,
  ReaccionActualizadaPayload,
  InstanciaCreadaPayload,
  ComandoEnviarMensajePayload,
  ComandoProcesarEntrantePayload,
  ComandoMarcarLeidoPayload,
  ComandoEnviarEmailPayload,
  ComandoInicializarInstanciaPayload,
} from "./registro";

// Catálogo nuevo — recomendado para código nuevo
export { EventosSistema, ComandosSistema } from "@/eventos/catalogo";
export type { NombreEvento, NombreComando } from "@/eventos/catalogo";
