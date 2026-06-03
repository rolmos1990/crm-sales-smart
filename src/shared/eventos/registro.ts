// Tipos de payload para cada evento de dominio del sistema

export interface ContactoCreadoPayload { contactoId: string; nombre: string; apellido: string; email?: string; empresaId?: string }
export interface ContactoActualizadoPayload { contactoId: string; cambios: Record<string, unknown> }
export interface ContactoEliminadoPayload { contactoId: string }
export interface ContactoAsignadoPayload { contactoId: string; usuarioId: string }

export interface EmpresaCreadaPayload { empresaId: string; nombre: string }
export interface EmpresaActualizadaPayload { empresaId: string; cambios: Record<string, unknown> }

export interface OportunidadCreadaPayload { oportunidadId: string; titulo: string; valor: number; contactoId?: string; empresaId?: string }
export interface OportunidadActualizadaPayload { oportunidadId: string; cambios: Record<string, unknown> }
export interface EtapaCambiadaPayload { oportunidadId: string; etapaAnterior: string; etapaNueva: string }
export interface OportunidadGanadaPayload { oportunidadId: string; valor: number; contactoId?: string }
export interface OportunidadPerdidaPayload { oportunidadId: string; motivo?: string }

export interface ActividadCreadaPayload { actividadId: string; tipo: string; fecha: Date; entidadId?: string; entidadTipo?: string }
export interface ActividadCompletadaPayload { actividadId: string; completadaEn: Date }

export interface ProductoCreadoPayload { productoId: string; nombre: string; precio: number }
export interface ProductoActualizadoPayload { productoId: string; cambios: Record<string, unknown> }
export interface PrecioActualizadoPayload { productoId: string; precioAnterior: number; precioNuevo: number }

export interface CotizacionCreadaPayload { cotizacionId: string; numero: string; total: number }
export interface CotizacionActualizadaPayload { cotizacionId: string; cambios: Record<string, unknown> }
export interface CotizacionEnviadaPayload { cotizacionId: string; numero: string; contactoId?: string }

export interface PedidoCreadoPayload { pedidoId: string; numero: string; total: number }
export interface PedidoActualizadoPayload { pedidoId: string; cambios: Record<string, unknown> }
export interface PedidoEntregadoPayload { pedidoId: string; numero: string }

export interface MensajeRecibidoPayload extends Record<string, unknown> { mensajeId: string; conversacionId: string; instanciaId: string; oportunidadId?: string | null }
export interface MensajeEnviadoPayload extends Record<string, unknown> { mensajeId: string; conversacionId: string; instanciaId: string }
export interface ConversacionCreadaPayload extends Record<string, unknown> { conversacionId: string; instanciaId: string; contactoId: string }
export interface ReaccionActualizadaPayload extends Record<string, unknown> { mensajeId: string; conversacionId: string; instanciaId: string }

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
} as const;

export type TipoEvento = (typeof TIPOS_EVENTO)[keyof typeof TIPOS_EVENTO];
