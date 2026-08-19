import { z } from "zod";
import { MetodoEntregaEnum, EstadoEntregaEnum } from "@/sales/pedidos/schema";

export { MetodoEntregaEnum, EstadoEntregaEnum };

export const LineaCotizacionSchema = z.object({
  productoId: z.string().optional().or(z.literal("")),
  descripcion: z.string().max(500).optional().or(z.literal("")),
  cantidad: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
  precioUnitario: z.number().min(0, "El precio debe ser mayor o igual a 0"),
  descuento: z.number().min(0).max(100),
});

export const DestinatarioCotizacionSchema = z.object({
  nombre: z.string().max(200).optional().or(z.literal("")),
  apellido: z.string().max(200).optional().or(z.literal("")),
  telefono: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
});

// Sin numeroGuia/urlSeguimiento: a esta altura (cotización) todavía no
// existen — se completan recién en el Pedido al aprobar (ver aprobarCotizacion).
export const EntregaCotizacionSchema = z.object({
  metodoEntrega: MetodoEntregaEnum.optional(),
  estadoEntrega: EstadoEntregaEnum.optional(),
  transportistaId: z.string().nullable().optional(),
  fechaEstimada: z.date().optional().nullable(),
  observaciones: z.string().max(500).optional().or(z.literal("")),
});

export const CrearCotizacionSchema = z.object({
  estado: z.enum(["BORRADOR", "REVISADA", "APROBADA", "ENVIADA", "RECHAZADA", "VENCIDA"]).optional(),
  fechaVencimiento: z.date().optional(),
  moneda: z.string().optional(),
  impuesto: z.number().min(0).max(100),
  notas: z.string().max(2000).optional().or(z.literal("")),
  // La cotización siempre se relaciona a un contacto (no a la oportunidad puntual):
  // así su historial se conserva aunque el contacto abra una nueva oportunidad.
  contactoId: z.string().min(1, "Selecciona un contacto"),
  empresaId: z.string().optional().or(z.literal("")),
  oportunidadId: z.string().optional().or(z.literal("")),
  destinatario: DestinatarioCotizacionSchema.optional(),
  entrega: EntregaCotizacionSchema.optional(),
  lineas: z.array(LineaCotizacionSchema).min(1, "Debe agregar al menos un producto"),
});

export const ActualizarCotizacionSchema = CrearCotizacionSchema.partial();

export type CrearCotizacionInput = z.infer<typeof CrearCotizacionSchema>;
export type ActualizarCotizacionInput = z.infer<typeof ActualizarCotizacionSchema>;
export type LineaCotizacionInput = z.infer<typeof LineaCotizacionSchema>;
export type DestinatarioCotizacionInput = z.infer<typeof DestinatarioCotizacionSchema>;
export type EntregaCotizacionInput = z.infer<typeof EntregaCotizacionSchema>;
