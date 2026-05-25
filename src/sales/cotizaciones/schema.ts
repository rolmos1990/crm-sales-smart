import { z } from "zod";

export const LineaCotizacionSchema = z.object({
  productoId: z.string().optional().or(z.literal("")),
  descripcion: z.string().max(500).optional().or(z.literal("")),
  cantidad: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
  precioUnitario: z.number().min(0, "El precio debe ser mayor o igual a 0"),
  descuento: z.number().min(0).max(100),
});

export const CrearCotizacionSchema = z.object({
  estado: z.enum(["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA", "VENCIDA"]).optional(),
  fechaVencimiento: z.date().optional(),
  moneda: z.string().optional(),
  impuesto: z.number().min(0).max(100),
  notas: z.string().max(2000).optional().or(z.literal("")),
  contactoId: z.string().optional().or(z.literal("")),
  empresaId: z.string().optional().or(z.literal("")),
  lineas: z.array(LineaCotizacionSchema).min(1, "Debe agregar al menos un producto"),
});

export const ActualizarCotizacionSchema = CrearCotizacionSchema.partial();

export type CrearCotizacionInput = z.infer<typeof CrearCotizacionSchema>;
export type ActualizarCotizacionInput = z.infer<typeof ActualizarCotizacionSchema>;
export type LineaCotizacionInput = z.infer<typeof LineaCotizacionSchema>;
