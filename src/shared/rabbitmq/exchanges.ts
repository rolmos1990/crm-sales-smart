export const EXCHANGE = "crm.x" as const;
export const DLX = "crm.dlx" as const;

export const QUEUES = {
  // Eventos de dominio
  SSE: "crm.sse",
  PEDIDO_HISTORIAL: "crm.pedido.historial",
  // Comandos
  MENSAJE_ENVIAR: "crm.comando.mensaje.enviar",
  MENSAJE_ENTRANTE: "crm.comando.mensaje.entrante",
  MENSAJE_LEIDO: "crm.comando.mensaje.leido",
  EMAIL_ENVIAR: "crm.comando.email",
  SISTEMA_INICIALIZAR: "crm.comando.sistema",
  // Dead letter
  MUERTOS: "crm.muertos",
} as const;

// Routing keys — prefijo "evento." para domain events, "comando." para async commands
export const RK = {
  // Dominio: conversaciones (van a SSE)
  EVENTO_CONVERSACION_CREADA: "evento.conversacion.creada",
  EVENTO_MENSAJE_RECIBIDO: "evento.mensaje.recibido",
  EVENTO_MENSAJE_ENVIADO: "evento.mensaje.enviado",
  EVENTO_REACCION_ACTUALIZADA: "evento.reaccion.actualizada",
  // Dominio: pedidos
  EVENTO_PEDIDO_CREADO: "evento.pedido.creado",
  EVENTO_PEDIDO_ACTUALIZADO: "evento.pedido.actualizado",
  EVENTO_PEDIDO_ENTREGADO: "evento.pedido.entregado",
  // Dominio: oportunidades
  EVENTO_OPORTUNIDAD_CREADA: "evento.oportunidad.creada",
  EVENTO_OPORTUNIDAD_ACTUALIZADA: "evento.oportunidad.actualizada",
  EVENTO_ETAPA_CAMBIADA: "evento.etapa.cambiada",
  EVENTO_OPORTUNIDAD_GANADA: "evento.oportunidad.ganada",
  EVENTO_OPORTUNIDAD_PERDIDA: "evento.oportunidad.perdida",
  // Dominio: contactos
  EVENTO_CONTACTO_CREADO: "evento.contacto.creado",
  EVENTO_CONTACTO_ACTUALIZADO: "evento.contacto.actualizado",
  EVENTO_CONTACTO_ELIMINADO: "evento.contacto.eliminado",
  EVENTO_CONTACTO_ASIGNADO: "evento.contacto.asignado",
  // Dominio: empresas
  EVENTO_EMPRESA_CREADA: "evento.empresa.creada",
  EVENTO_EMPRESA_ACTUALIZADA: "evento.empresa.actualizada",
  // Dominio: actividades
  EVENTO_ACTIVIDAD_CREADA: "evento.actividad.creada",
  EVENTO_ACTIVIDAD_COMPLETADA: "evento.actividad.completada",
  // Dominio: productos
  EVENTO_PRODUCTO_CREADO: "evento.producto.creado",
  EVENTO_PRODUCTO_ACTUALIZADO: "evento.producto.actualizado",
  EVENTO_PRECIO_ACTUALIZADO: "evento.precio.actualizado",
  // Dominio: cotizaciones
  EVENTO_COTIZACION_CREADA: "evento.cotizacion.creada",
  EVENTO_COTIZACION_ACTUALIZADA: "evento.cotizacion.actualizada",
  EVENTO_COTIZACION_ENVIADA: "evento.cotizacion.enviada",
  // Dominio: instancias
  EVENTO_INSTANCIA_CREADA: "evento.instancia.creada",
  // Comandos
  COMANDO_MENSAJE_ENVIAR: "comando.mensaje.enviar",
  COMANDO_MENSAJE_ENTRANTE: "comando.mensaje.entrante",
  COMANDO_MENSAJE_LEIDO: "comando.mensaje.leido",
  COMANDO_EMAIL_ENVIAR: "comando.email.enviar",
  COMANDO_SISTEMA_INICIALIZAR: "comando.sistema.inicializar",
} as const;

export type RoutingKey = (typeof RK)[keyof typeof RK];

// Mapa de TIPOS_EVENTO y TIPOS_COMANDO → routing key para el publicador
export const TIPO_EVENTO_A_RK: Record<string, RoutingKey> = {
  // Comandos
  ENVIAR_MENSAJE: RK.COMANDO_MENSAJE_ENVIAR,
  PROCESAR_ENTRANTE: RK.COMANDO_MENSAJE_ENTRANTE,
  MARCAR_LEIDO: RK.COMANDO_MENSAJE_LEIDO,
  ENVIAR_EMAIL: RK.COMANDO_EMAIL_ENVIAR,
  INICIALIZAR_INSTANCIA: RK.COMANDO_SISTEMA_INICIALIZAR,
  CONTACTO_CREADO: RK.EVENTO_CONTACTO_CREADO,
  CONTACTO_ACTUALIZADO: RK.EVENTO_CONTACTO_ACTUALIZADO,
  CONTACTO_ELIMINADO: RK.EVENTO_CONTACTO_ELIMINADO,
  CONTACTO_ASIGNADO: RK.EVENTO_CONTACTO_ASIGNADO,
  EMPRESA_CREADA: RK.EVENTO_EMPRESA_CREADA,
  EMPRESA_ACTUALIZADA: RK.EVENTO_EMPRESA_ACTUALIZADA,
  OPORTUNIDAD_CREADA: RK.EVENTO_OPORTUNIDAD_CREADA,
  OPORTUNIDAD_ACTUALIZADA: RK.EVENTO_OPORTUNIDAD_ACTUALIZADA,
  ETAPA_CAMBIADA: RK.EVENTO_ETAPA_CAMBIADA,
  OPORTUNIDAD_GANADA: RK.EVENTO_OPORTUNIDAD_GANADA,
  OPORTUNIDAD_PERDIDA: RK.EVENTO_OPORTUNIDAD_PERDIDA,
  ACTIVIDAD_CREADA: RK.EVENTO_ACTIVIDAD_CREADA,
  ACTIVIDAD_COMPLETADA: RK.EVENTO_ACTIVIDAD_COMPLETADA,
  PRODUCTO_CREADO: RK.EVENTO_PRODUCTO_CREADO,
  PRODUCTO_ACTUALIZADO: RK.EVENTO_PRODUCTO_ACTUALIZADO,
  PRECIO_ACTUALIZADO: RK.EVENTO_PRECIO_ACTUALIZADO,
  COTIZACION_CREADA: RK.EVENTO_COTIZACION_CREADA,
  COTIZACION_ACTUALIZADA: RK.EVENTO_COTIZACION_ACTUALIZADA,
  COTIZACION_ENVIADA: RK.EVENTO_COTIZACION_ENVIADA,
  PEDIDO_CREADO: RK.EVENTO_PEDIDO_CREADO,
  PEDIDO_ACTUALIZADO: RK.EVENTO_PEDIDO_ACTUALIZADO,
  PEDIDO_ENTREGADO: RK.EVENTO_PEDIDO_ENTREGADO,
  MENSAJE_RECIBIDO: RK.EVENTO_MENSAJE_RECIBIDO,
  MENSAJE_ENVIADO: RK.EVENTO_MENSAJE_ENVIADO,
  CONVERSACION_CREADA: RK.EVENTO_CONVERSACION_CREADA,
  REACCION_ACTUALIZADA: RK.EVENTO_REACCION_ACTUALIZADA,
  INSTANCIA_CREADA: RK.EVENTO_INSTANCIA_CREADA,
};
