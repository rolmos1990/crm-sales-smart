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

export type CrearPedidoInput = z.infer<typeof CrearPedidoSchema>;
export type ActualizarEstadoPedidoInput = z.infer<typeof ActualizarEstadoPedidoSchema>;
export type LineaPedidoInput = z.infer<typeof LineaPedidoSchema>;
