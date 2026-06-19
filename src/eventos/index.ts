// Punto de entrada único para contratos de eventos y catálogos del sistema.
// Importar desde aquí en lugar de paths individuales de contratos.

export type { EventoDominio } from "./contratos/base.event";

export { EventosSistema, ComandosSistema } from "./catalogo";
export type { NombreEvento, NombreComando } from "./catalogo";

// Eventos de dominio
export type { ContactoCreadoPayload }      from "./contratos/contacto-creado.event";
export type { ContactoActualizadoPayload } from "./contratos/contacto-actualizado.event";
export type { ContactoEliminadoPayload }   from "./contratos/contacto-eliminado.event";
export type { ContactoAsignadoPayload }    from "./contratos/contacto-asignado.event";

export type { EmpresaCreadaPayload }       from "./contratos/empresa-creada.event";
export type { EmpresaActualizadaPayload }  from "./contratos/empresa-actualizada.event";

export type { OportunidadCreadaPayload }      from "./contratos/oportunidad-creada.event";
export type { OportunidadActualizadaPayload } from "./contratos/oportunidad-actualizada.event";
export type { EtapaCambiadaPayload }          from "./contratos/etapa-cambiada.event";
export type { OportunidadGanadaPayload }      from "./contratos/oportunidad-ganada.event";
export type { OportunidadPerdidaPayload }     from "./contratos/oportunidad-perdida.event";

export type { ActividadCreadaPayload }     from "./contratos/actividad-creada.event";
export type { ActividadCompletadaPayload } from "./contratos/actividad-completada.event";

export type { ProductoCreadoPayload }     from "./contratos/producto-creado.event";
export type { ProductoActualizadoPayload } from "./contratos/producto-actualizado.event";
export type { PrecioActualizadoPayload }  from "./contratos/precio-actualizado.event";

export type { CotizacionCreadaPayload }     from "./contratos/cotizacion-creada.event";
export type { CotizacionActualizadaPayload } from "./contratos/cotizacion-actualizada.event";
export type { CotizacionEnviadaPayload }    from "./contratos/cotizacion-enviada.event";

export type { PedidoCreadoPayload }      from "./contratos/pedido-creado.event";
export type { PedidoActualizadoPayload, EntradaHistorialPedido } from "./contratos/pedido-actualizado.event";
export type { PedidoEntregadoPayload }   from "./contratos/pedido-entregado.event";

export type { MensajeRecibidoPayload }    from "./contratos/mensaje-recibido.event";
export type { MensajeEnviadoPayload }     from "./contratos/mensaje-enviado.event";
export type { ConversacionCreadaPayload } from "./contratos/conversacion-creada.event";
export type { ReaccionActualizadaPayload } from "./contratos/reaccion-actualizada.event";

export type { InstanciaCreadaPayload } from "./contratos/instancia-creada.event";

// Comandos asincrónicos
export type { ComandoEnviarMensajePayload }       from "./contratos/enviar-mensaje.comando";
export type { ComandoProcesarEntrantePayload }    from "./contratos/procesar-entrante.comando";
export type { ComandoMarcarLeidoPayload }         from "./contratos/marcar-leido.comando";
export type { ComandoEnviarEmailPayload }         from "./contratos/enviar-email.comando";
export type { ComandoInicializarInstanciaPayload } from "./contratos/inicializar-instancia.comando";
