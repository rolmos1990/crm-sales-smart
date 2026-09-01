// Re-exports de compatibilidad — los contratos viven en src/eventos/
// Importar directamente desde "@/eventos" en código nuevo.

export type { ContactoCreadoPayload }      from "@/eventos/contratos/contacto-creado.event";
export type { ContactoActualizadoPayload } from "@/eventos/contratos/contacto-actualizado.event";
export type { ContactoEliminadoPayload }   from "@/eventos/contratos/contacto-eliminado.event";
export type { ContactoAsignadoPayload }    from "@/eventos/contratos/contacto-asignado.event";

export type { EmpresaCreadaPayload }       from "@/eventos/contratos/empresa-creada.event";
export type { EmpresaActualizadaPayload }  from "@/eventos/contratos/empresa-actualizada.event";

export type { OportunidadCreadaPayload }      from "@/eventos/contratos/oportunidad-creada.event";
export type { OportunidadActualizadaPayload } from "@/eventos/contratos/oportunidad-actualizada.event";
export type { EtapaCambiadaPayload }          from "@/eventos/contratos/etapa-cambiada.event";
export type { OportunidadGanadaPayload }      from "@/eventos/contratos/oportunidad-ganada.event";
export type { OportunidadPerdidaPayload }     from "@/eventos/contratos/oportunidad-perdida.event";

export type { ActividadCreadaPayload }     from "@/eventos/contratos/actividad-creada.event";
export type { ActividadCompletadaPayload } from "@/eventos/contratos/actividad-completada.event";

export type { ProductoCreadoPayload }      from "@/eventos/contratos/producto-creado.event";
export type { ProductoActualizadoPayload } from "@/eventos/contratos/producto-actualizado.event";
export type { PrecioActualizadoPayload }   from "@/eventos/contratos/precio-actualizado.event";

export type { CotizacionCreadaPayload }     from "@/eventos/contratos/cotizacion-creada.event";
export type { CotizacionActualizadaPayload } from "@/eventos/contratos/cotizacion-actualizada.event";
export type { CotizacionEnviadaPayload }    from "@/eventos/contratos/cotizacion-enviada.event";

export type { PedidoCreadoPayload }      from "@/eventos/contratos/pedido-creado.event";
export type { PedidoActualizadoPayload, EntradaHistorialPedido } from "@/eventos/contratos/pedido-actualizado.event";
export type { PedidoEntregadoPayload }   from "@/eventos/contratos/pedido-entregado.event";

export type { MensajeRecibidoPayload }    from "@/eventos/contratos/mensaje-recibido.event";
export type { MensajeEnviadoPayload }     from "@/eventos/contratos/mensaje-enviado.event";
export type { ConversacionCreadaPayload } from "@/eventos/contratos/conversacion-creada.event";
export type { ReaccionActualizadaPayload } from "@/eventos/contratos/reaccion-actualizada.event";

export type { InstanciaCreadaPayload } from "@/eventos/contratos/instancia-creada.event";

export type { ComandoEnviarMensajePayload }        from "@/eventos/contratos/enviar-mensaje.comando";
export type { ComandoProcesarEntrantePayload }     from "@/eventos/contratos/procesar-entrante.comando";
export type { ComandoProcesarMensajeAppNativaPayload } from "@/eventos/contratos/procesar-mensaje-app-nativa.comando";
export type { ComandoMarcarLeidoPayload }          from "@/eventos/contratos/marcar-leido.comando";
export type { ComandoEnviarEmailPayload }          from "@/eventos/contratos/enviar-email.comando";
export type { ComandoInicializarInstanciaPayload } from "@/eventos/contratos/inicializar-instancia.comando";

// Constantes de tipos de evento (SNAKE_UPPER) — mantener para compatibilidad.
// Usar EventosSistema / ComandosSistema de "@/eventos" en código nuevo.
export const TIPOS_EVENTO = {
  CONTACTO_CREADO:         "CONTACTO_CREADO",
  CONTACTO_ACTUALIZADO:    "CONTACTO_ACTUALIZADO",
  CONTACTO_ELIMINADO:      "CONTACTO_ELIMINADO",
  CONTACTO_ASIGNADO:       "CONTACTO_ASIGNADO",
  EMPRESA_CREADA:          "EMPRESA_CREADA",
  EMPRESA_ACTUALIZADA:     "EMPRESA_ACTUALIZADA",
  OPORTUNIDAD_CREADA:      "OPORTUNIDAD_CREADA",
  OPORTUNIDAD_ACTUALIZADA: "OPORTUNIDAD_ACTUALIZADA",
  ETAPA_CAMBIADA:          "ETAPA_CAMBIADA",
  OPORTUNIDAD_GANADA:      "OPORTUNIDAD_GANADA",
  OPORTUNIDAD_PERDIDA:     "OPORTUNIDAD_PERDIDA",
  ACTIVIDAD_CREADA:        "ACTIVIDAD_CREADA",
  ACTIVIDAD_COMPLETADA:    "ACTIVIDAD_COMPLETADA",
  PRODUCTO_CREADO:         "PRODUCTO_CREADO",
  PRODUCTO_ACTUALIZADO:    "PRODUCTO_ACTUALIZADO",
  PRECIO_ACTUALIZADO:      "PRECIO_ACTUALIZADO",
  COTIZACION_CREADA:       "COTIZACION_CREADA",
  COTIZACION_ACTUALIZADA:  "COTIZACION_ACTUALIZADA",
  COTIZACION_ENVIADA:      "COTIZACION_ENVIADA",
  PEDIDO_CREADO:           "PEDIDO_CREADO",
  PEDIDO_ACTUALIZADO:      "PEDIDO_ACTUALIZADO",
  PEDIDO_ENTREGADO:        "PEDIDO_ENTREGADO",
  MENSAJE_RECIBIDO:        "MENSAJE_RECIBIDO",
  MENSAJE_ENVIADO:         "MENSAJE_ENVIADO",
  CONVERSACION_CREADA:     "CONVERSACION_CREADA",
  REACCION_ACTUALIZADA:    "REACCION_ACTUALIZADA",
  INSTANCIA_CREADA:        "INSTANCIA_CREADA",
} as const;

export const TIPOS_COMANDO = {
  ENVIAR_MENSAJE:        "ENVIAR_MENSAJE",
  PROCESAR_ENTRANTE:     "PROCESAR_ENTRANTE",
  PROCESAR_MENSAJE_APP_NATIVA: "PROCESAR_MENSAJE_APP_NATIVA",
  MARCAR_LEIDO:          "MARCAR_LEIDO",
  ENVIAR_EMAIL:          "ENVIAR_EMAIL",
  INICIALIZAR_INSTANCIA: "INICIALIZAR_INSTANCIA",
} as const;

export type TipoEvento = (typeof TIPOS_EVENTO)[keyof typeof TIPOS_EVENTO];
export type TipoComando = (typeof TIPOS_COMANDO)[keyof typeof TIPOS_COMANDO];
