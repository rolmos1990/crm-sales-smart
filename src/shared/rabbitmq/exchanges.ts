export const EXCHANGE = "crm.x" as const;
export const DLX = "crm.dlx" as const;

export const QUEUES = {
  // Eventos de dominio
  SSE: "crm.sse",
  PEDIDO_HISTORIAL: "crm.pedido.historial",
  COTIZACION_APROBADA: "crm.cotizacion.aprobada",
  // Comandos
  MENSAJE_ENVIAR: "crm.comando.mensaje.enviar",
  MENSAJE_ENTRANTE: "crm.comando.mensaje.entrante",
  MENSAJE_LEIDO: "crm.comando.mensaje.leido",
  EMAIL_ENVIAR: "crm.comando.email",
  SISTEMA_INICIALIZAR: "crm.comando.sistema",
  // Dead letter
  MUERTOS: "crm.muertos",
  // IA
  AI_RESPUESTA: "crm.ai.comando.respuesta",
  AI_RESUMEN: "crm.ai.comando.resumen",
  AI_ORQUESTAR: "crm.ai.orquestar",
  // 012-perfil-dinamico-cliente
  PERFIL_CLIENTE_INVALIDAR: "crm.perfil-cliente.invalidar",
} as const;

// Routing keys — prefijo "evento." para domain events, "comando." para async commands
export const RK = {
  // Dominio: conversaciones (van a SSE)
  EVENTO_CONVERSACION_CREADA: "evento.conversacion.creada",
  EVENTO_CONVERSACION_CLASIFICADA: "evento.conversacion.clasificada",
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
  EVENTO_COTIZACION_APROBADA: "evento.cotizacion.aprobada",
  // Dominio: instancias
  EVENTO_INSTANCIA_CREADA: "evento.instancia.creada",
  // Comandos
  COMANDO_MENSAJE_ENVIAR: "comando.mensaje.enviar",
  COMANDO_MENSAJE_ENTRANTE: "comando.mensaje.entrante",
  COMANDO_MENSAJE_LEIDO: "comando.mensaje.leido",
  COMANDO_EMAIL_ENVIAR: "comando.email.enviar",
  COMANDO_SISTEMA_INICIALIZAR: "comando.sistema.inicializar",
  // IA
  EVENTO_IA_RESPUESTA_GENERADA: "evento.ia.respuesta.generada",
  EVENTO_IA_LIMITE_ALCANZADO: "evento.ia.limite.alcanzado",
  COMANDO_AI_GENERAR_RESPUESTA: "comando.ai.generar.respuesta",
  COMANDO_AI_RESUMIR: "comando.ai.resumir",
  COMANDO_AI_CLASIFICAR: "comando.ai.clasificar",
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
  COTIZACION_APROBADA: RK.EVENTO_COTIZACION_APROBADA,
  PEDIDO_CREADO: RK.EVENTO_PEDIDO_CREADO,
  PEDIDO_ACTUALIZADO: RK.EVENTO_PEDIDO_ACTUALIZADO,
  PEDIDO_ENTREGADO: RK.EVENTO_PEDIDO_ENTREGADO,
  MENSAJE_RECIBIDO: RK.EVENTO_MENSAJE_RECIBIDO,
  MENSAJE_ENVIADO: RK.EVENTO_MENSAJE_ENVIADO,
  CONVERSACION_CREADA: RK.EVENTO_CONVERSACION_CREADA,
  CONVERSACION_CLASIFICADA: RK.EVENTO_CONVERSACION_CLASIFICADA,
  REACCION_ACTUALIZADA: RK.EVENTO_REACCION_ACTUALIZADA,
  INSTANCIA_CREADA: RK.EVENTO_INSTANCIA_CREADA,
  RESPUESTA_IA_GENERADA: RK.EVENTO_IA_RESPUESTA_GENERADA,
  LIMITE_IA_ALCANZADO: RK.EVENTO_IA_LIMITE_ALCANZADO,
  GENERAR_RESPUESTA_IA: RK.COMANDO_AI_GENERAR_RESPUESTA,
  RESUMIR_CONVERSACION: RK.COMANDO_AI_RESUMIR,
  CLASIFICAR_CONVERSACION: RK.COMANDO_AI_CLASIFICAR,
};
