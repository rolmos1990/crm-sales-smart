// Catálogo oficial de eventos de dominio del sistema.
// Usar estas constantes en lugar de strings literales al publicar o suscribirse a eventos.

export const EventosSistema = {
  // Contactos
  ContactoCreado:         "CONTACTO_CREADO",
  ContactoActualizado:    "CONTACTO_ACTUALIZADO",
  ContactoEliminado:      "CONTACTO_ELIMINADO",
  ContactoAsignado:       "CONTACTO_ASIGNADO",

  // Empresas
  EmpresaCreada:          "EMPRESA_CREADA",
  EmpresaActualizada:     "EMPRESA_ACTUALIZADA",

  // Oportunidades
  OportunidadCreada:      "OPORTUNIDAD_CREADA",
  OportunidadActualizada: "OPORTUNIDAD_ACTUALIZADA",
  EtapaCambiada:          "ETAPA_CAMBIADA",
  OportunidadGanada:      "OPORTUNIDAD_GANADA",
  OportunidadPerdida:     "OPORTUNIDAD_PERDIDA",

  // Actividades
  ActividadCreada:        "ACTIVIDAD_CREADA",
  ActividadCompletada:    "ACTIVIDAD_COMPLETADA",

  // Productos
  ProductoCreado:         "PRODUCTO_CREADO",
  ProductoActualizado:    "PRODUCTO_ACTUALIZADO",
  PrecioActualizado:      "PRECIO_ACTUALIZADO",

  // Cotizaciones
  CotizacionCreada:       "COTIZACION_CREADA",
  CotizacionActualizada:  "COTIZACION_ACTUALIZADA",
  CotizacionEnviada:      "COTIZACION_ENVIADA",

  // Pedidos
  PedidoCreado:           "PEDIDO_CREADO",
  PedidoActualizado:      "PEDIDO_ACTUALIZADO",
  PedidoEntregado:        "PEDIDO_ENTREGADO",

  // Mensajería
  MensajeRecibido:        "MENSAJE_RECIBIDO",
  MensajeEnviado:         "MENSAJE_ENVIADO",
  ConversacionCreada:     "CONVERSACION_CREADA",
  ReaccionActualizada:    "REACCION_ACTUALIZADA",

  // Sistema
  InstanciaCreada:        "INSTANCIA_CREADA",
} as const;

export type NombreEvento = (typeof EventosSistema)[keyof typeof EventosSistema];

// Catálogo oficial de comandos asincrónicos del sistema.
export const ComandosSistema = {
  EnviarMensaje:          "ENVIAR_MENSAJE",
  ProcesarEntrante:       "PROCESAR_ENTRANTE",
  MarcarLeido:            "MARCAR_LEIDO",
  EnviarEmail:            "ENVIAR_EMAIL",
  InicializarInstancia:   "INICIALIZAR_INSTANCIA",
} as const;

export type NombreComando = (typeof ComandosSistema)[keyof typeof ComandosSistema];
