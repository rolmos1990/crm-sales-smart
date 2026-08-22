import { z } from "zod";

export const LineaPedidoSchema = z.object({
  productoId: z.string().optional().or(z.literal("")),
  descripcion: z.string().max(500).optional().or(z.literal("")),
  cantidad: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
  precioUnitario: z.number().min(0, "El precio debe ser mayor o igual a 0"),
  descuento: z.number().min(0).max(100),
});

export const CrearPedidoSchema = z.object({
  estado: z.enum(["PENDIENTE", "CONFIRMADO", "EN_PROCESO", "ENVIADO", "ENTREGADO", "CANCELADO"]).optional(),
  fechaEntrega: z.date().optional(),
  fechaExpiracion: z.date().optional(),
  moneda: z.string().optional(),
  impuesto: z.number().min(0).max(100),
  notas: z.string().max(2000).optional().or(z.literal("")),
  // Relaciones CRM
  contactoId: z.string().optional().or(z.literal("")),
  empresaId: z.string().optional().or(z.literal("")),
  cotizacionId: z.string().optional().or(z.literal("")),
  // Datos del comprador (pedido manual)
  nombre: z.string().max(100).optional().or(z.literal("")),
  apellido: z.string().max(100).optional().or(z.literal("")),
  telefono: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  ruc: z.string().max(20).optional().or(z.literal("")),
  empresaNombre: z.string().max(200).optional().or(z.literal("")),
  lineas: z.array(LineaPedidoSchema).min(1, "Debe agregar al menos un producto"),
});

export const ActualizarEstadoPedidoSchema = z.object({
  estado: z.enum(["PENDIENTE", "CONFIRMADO", "EN_PROCESO", "ENVIADO", "ENTREGADO", "CANCELADO"]),
});

export const LineaPedidoEditSchema = LineaPedidoSchema.extend({
  id: z.string().optional(),
});

export const EditarPedidoSchema = z.object({
  estado: z.enum(["PENDIENTE", "CONFIRMADO", "EN_PROCESO", "ENVIADO", "ENTREGADO", "CANCELADO"]).optional(),
  fechaEntrega: z.date().optional(),
  fechaExpiracion: z.date().optional(),
  moneda: z.string().optional(),
  impuesto: z.number().min(0).max(100),
  notas: z.string().max(2000).optional().or(z.literal("")),
  contactoId: z.string().optional().or(z.literal("")),
  empresaId: z.string().optional().or(z.literal("")),
  nombre: z.string().max(100).optional().or(z.literal("")),
  apellido: z.string().max(100).optional().or(z.literal("")),
  telefono: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  ruc: z.string().max(20).optional().or(z.literal("")),
  empresaNombre: z.string().max(200).optional().or(z.literal("")),
  lineas: z.array(LineaPedidoEditSchema).min(1, "Debe agregar al menos un producto"),
});

export const MetodoEntregaEnum = z.enum([
  "COURIER_EXTERNO",
  "MENSAJERO_PROPIO",
  "RETIRO_TIENDA",
  "DIGITAL",
  "INSTALACION_SERVICIO",
]);

export const EstadoEntregaEnum = z.enum([
  "PENDIENTE",
  "PREPARANDO",
  "EN_CAMINO",
  "ENTREGADO",
  "FALLIDO",
  "CANCELADO",
  "DEVUELTO",
]);

export const ActualizarEntregaPedidoSchema = z.object({
  pedidoId:        z.string().min(1),
  metodoEntrega:   MetodoEntregaEnum,
  estadoEntrega:   EstadoEntregaEnum,
  transportistaId: z.string().nullable().optional(),
  numeroGuia:      z.string().max(120).optional().or(z.literal("")),
  urlSeguimiento:  z.string().url("URL de seguimiento inválida").optional().or(z.literal("")),
  fechaEstimada:   z.string().datetime({ offset: true }).optional().nullable(),
  observaciones:   z.string().max(500).optional().or(z.literal("")),
  // Vive en Pedido.costoEnvio (no en EntregaPedido) — así el KPI "Total
  // ventas" puede restarlo con un simple _sum, sin join (ver queries.ts).
  costoEnvio:      z.number().min(0).optional(),
});

// Sin campos obligatorios a propósito — el Flujo de Venta resuelve después
// qué debe completarse para avanzar de etapa, esto solo guarda el dato
// (mismo criterio que ActualizarEntregaPedidoSchema).
export const ModalidadServicioEnum = z.enum(["EN_ESTABLECIMIENTO", "A_DOMICILIO", "REMOTO", "OTRO"]);

export const ActualizarServicioPedidoSchema = z.object({
  pedidoId: z.string().min(1),
  modalidad: ModalidadServicioEnum.optional().nullable(),
  fecha: z.string().datetime({ offset: true }).optional().nullable(),
  hora: z.string().max(20).optional().or(z.literal("")),
  duracion: z.string().max(100).optional().or(z.literal("")),
  ubicacion: z.string().max(200).optional().or(z.literal("")),
  direccion: z.string().max(300).optional().or(z.literal("")),
  responsable: z.string().max(200).optional().or(z.literal("")),
  instrucciones: z.string().max(500).optional().or(z.literal("")),
  observaciones: z.string().max(500).optional().or(z.literal("")),
});

// No reutiliza MetodoEntregaEnum.DIGITAL — ese es el canal de un delivery
// físico, un concepto distinto (ver MetodoEntregaDigital en schema.prisma).
export const MetodoEntregaDigitalEnum = z.enum(["EMAIL", "LINK", "DESCARGA", "ACCESO", "LICENCIA", "MANUAL", "OTRO"]);

// Por línea, no por pedido completo — un pedido puede tener varios
// productos DIGITAL distintos, cada uno con su propia entrega (ver
// EntregaDigitalPedido en schema.prisma). Sin `codigo` real a propósito —
// el cliente solo puede pedir "conservar" o "reemplazar" (ver
// src/shared/lib/codigo-sensible.ts), nunca manda ni recibe el valor
// existente.
export const ActualizarEntregaDigitalPedidoSchema = z.object({
  pedidoLineaId: z.string().min(1),
  metodo: MetodoEntregaDigitalEnum.optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  url: z.string().max(500).optional().or(z.literal("")),
  archivo: z.string().max(500).optional().or(z.literal("")),
  usuarioAcceso: z.string().max(200).optional().or(z.literal("")),
  fechaEntrega: z.string().datetime({ offset: true }).optional().nullable(),
  fechaExpiracion: z.string().datetime({ offset: true }).optional().nullable(),
  instrucciones: z.string().max(500).optional().or(z.literal("")),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  codigoAccion: z.enum(["CONSERVAR", "REEMPLAZAR"]).optional(),
  codigoNuevo: z.string().max(200).optional().or(z.literal("")),
});

export type CrearPedidoInput = z.infer<typeof CrearPedidoSchema>;
export type EditarPedidoInput = z.infer<typeof EditarPedidoSchema>;
export type ActualizarEstadoPedidoInput = z.infer<typeof ActualizarEstadoPedidoSchema>;
export type ActualizarEntregaPedidoInput = z.infer<typeof ActualizarEntregaPedidoSchema>;
export type ActualizarServicioPedidoInput = z.infer<typeof ActualizarServicioPedidoSchema>;
export type ActualizarEntregaDigitalPedidoInput = z.infer<typeof ActualizarEntregaDigitalPedidoSchema>;
export type LineaPedidoInput = z.infer<typeof LineaPedidoSchema>;
export type LineaPedidoEditInput = z.infer<typeof LineaPedidoEditSchema>;
