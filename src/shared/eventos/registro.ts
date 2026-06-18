// Tipos de payload para cada evento de dominio del sistema.
// Todos los payloads incluyen instanciaId — requerido para procesamiento stateless.

export interface ContactoCreadoPayload { instanciaId: string; contactoId: string; nombre: string; apellido: string; email?: string; empresaId?: string }
export interface ContactoActualizadoPayload { instanciaId: string; contactoId: string; cambios: Record<string, unknown> }
export interface ContactoEliminadoPayload { instanciaId: string; contactoId: string }
export interface ContactoAsignadoPayload { instanciaId: string; contactoId: string; usuarioId: string }

export interface EmpresaCreadaPayload { instanciaId: string; empresaId: string; nombre: string }
export interface EmpresaActualizadaPayload { instanciaId: string; empresaId: string; cambios: Record<string, unknown> }

export interface OportunidadCreadaPayload { instanciaId: string; oportunidadId: string; titulo: string; valor: number; contactoId?: string; empresaId?: string }
export interface OportunidadActualizadaPayload { instanciaId: string; oportunidadId: string; cambios: Record<string, unknown> }
export interface EtapaCambiadaPayload { instanciaId: string; oportunidadId: string; etapaAnterior: string; etapaNueva: string }
export interface OportunidadGanadaPayload { instanciaId: string; oportunidadId: string; valor: number; contactoId?: string }
export interface OportunidadPerdidaPayload { instanciaId: string; oportunidadId: string; motivo?: string }

export interface ActividadCreadaPayload { instanciaId: string; actividadId: string; tipo: string; fecha: Date; entidadId?: string; entidadTipo?: string }
export interface ActividadCompletadaPayload { instanciaId: string; actividadId: string; completadaEn: Date }

export interface ProductoCreadoPayload { instanciaId: string; productoId: string; nombre: string; precio: number }
export interface ProductoActualizadoPayload { instanciaId: string; productoId: string; cambios: Record<string, unknown> }
export interface PrecioActualizadoPayload { instanciaId: string; productoId: string; precioAnterior: number; precioNuevo: number }

export interface CotizacionCreadaPayload { instanciaId: string; cotizacionId: string; numero: string; total: number }
export interface CotizacionActualizadaPayload { instanciaId: string; cotizacionId: string; cambios: Record<string, unknown> }
export interface CotizacionEnviadaPayload { instanciaId: string; cotizacionId: string; numero: string; contactoId?: string }

export interface PedidoCreadoPayload extends Record<string, unknown> {
  instanciaId: string;
  pedidoId: string;
  numero: string;
  total: number;
  usuarioId: string | null;
  usuarioNombre: string | null;
}

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

export interface PedidoEntregadoPayload extends Record<string, unknown> { instanciaId: string; pedidoId: string; numero: string }

export interface MensajeRecibidoPayload extends Record<string, unknown> { mensajeId: string; conversacionId: string; instanciaId: string; oportunidadId?: string | null }
export interface MensajeEnviadoPayload extends Record<string, unknown> { mensajeId: string; conversacionId: string; instanciaId: string }
export interface ConversacionCreadaPayload extends Record<string, unknown> { conversacionId: string; instanciaId: string; contactoId: string }
export interface ReaccionActualizadaPayload extends Record<string, unknown> { mensajeId: string; conversacionId: string; instanciaId: string }

export interface InstanciaCreadaPayload extends Record<string, unknown> { instanciaId: string; nombre: string; slug: string }

// ── Payloads de comandos (async operations via RabbitMQ) ─────────────────────

export interface ComandoEnviarMensajePayload extends Record<string, unknown> {
  instanciaId: string;
  mensajeId: string;
  conversacionId: string;
  cuentaCanalId: string;
  tipo: string;
  destinatario: string;
  contenido?: string;
  mediaUrl?: string;
}

export interface ComandoProcesarEntrantePayload extends Record<string, unknown> {
  instanciaId: string;
  canal: string;
  identificadorContacto: string;
  cuentaCanalId: string;
  contenido?: string;
  tipo: string;
  idExterno?: string;
  pushName?: string;
  avatarUrl?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaDuracion?: number;
  mediaArchivoId?: string;
}

export interface ComandoMarcarLeidoPayload extends Record<string, unknown> {
  instanciaId: string;
  mensajeIds: string[];
  conversacionId: string;
}

export interface ComandoEnviarEmailPayload extends Record<string, unknown> {
  instanciaId: string;
  tipo: string;
  destinatario: string[];
  data: unknown;
}

export interface ComandoInicializarInstanciaPayload extends Record<string, unknown> {
  instanciaId: string;
}

export const TIPOS_EVENTO = {
  CONTACTO_CREADO: "CONTACTO_CREADO",
  CONTACTO_ACTUALIZADO: "CONTACTO_ACTUALIZADO",
  CONTACTO_ELIMINADO: "CONTACTO_ELIMINADO",
  CONTACTO_ASIGNADO: "CONTACTO_ASIGNADO",
  EMPRESA_CREADA: "EMPRESA_CREADA",
  EMPRESA_ACTUALIZADA: "EMPRESA_ACTUALIZADA",
  OPORTUNIDAD_CREADA: "OPORTUNIDAD_CREADA",
  OPORTUNIDAD_ACTUALIZADA: "OPORTUNIDAD_ACTUALIZADA",
  ETAPA_CAMBIADA: "ETAPA_CAMBIADA",
  OPORTUNIDAD_GANADA: "OPORTUNIDAD_GANADA",
  OPORTUNIDAD_PERDIDA: "OPORTUNIDAD_PERDIDA",
  ACTIVIDAD_CREADA: "ACTIVIDAD_CREADA",
  ACTIVIDAD_COMPLETADA: "ACTIVIDAD_COMPLETADA",
  PRODUCTO_CREADO: "PRODUCTO_CREADO",
  PRODUCTO_ACTUALIZADO: "PRODUCTO_ACTUALIZADO",
  PRECIO_ACTUALIZADO: "PRECIO_ACTUALIZADO",
  COTIZACION_CREADA: "COTIZACION_CREADA",
  COTIZACION_ACTUALIZADA: "COTIZACION_ACTUALIZADA",
  COTIZACION_ENVIADA: "COTIZACION_ENVIADA",
  PEDIDO_CREADO: "PEDIDO_CREADO",
  PEDIDO_ACTUALIZADO: "PEDIDO_ACTUALIZADO",
  PEDIDO_ENTREGADO: "PEDIDO_ENTREGADO",
  MENSAJE_RECIBIDO: "MENSAJE_RECIBIDO",
  MENSAJE_ENVIADO: "MENSAJE_ENVIADO",
  CONVERSACION_CREADA: "CONVERSACION_CREADA",
  REACCION_ACTUALIZADA: "REACCION_ACTUALIZADA",
  INSTANCIA_CREADA: "INSTANCIA_CREADA",
} as const;

export const TIPOS_COMANDO = {
  ENVIAR_MENSAJE: "ENVIAR_MENSAJE",
  PROCESAR_ENTRANTE: "PROCESAR_ENTRANTE",
  MARCAR_LEIDO: "MARCAR_LEIDO",
  ENVIAR_EMAIL: "ENVIAR_EMAIL",
  INICIALIZAR_INSTANCIA: "INICIALIZAR_INSTANCIA",
} as const;

export type TipoEvento = (typeof TIPOS_EVENTO)[keyof typeof TIPOS_EVENTO];
export type TipoComando = (typeof TIPOS_COMANDO)[keyof typeof TIPOS_COMANDO];
