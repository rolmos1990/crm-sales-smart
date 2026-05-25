import { z } from "zod";

export const CrearProductoSchema = z.object({
  sku: z.string().max(100).optional().or(z.literal("")),
  nombre: z.string().min(1, "El nombre es requerido").max(200),
  descripcion: z.string().max(1000).optional().or(z.literal("")),
  precio: z.number().min(0, "El precio debe ser mayor o igual a 0"),
  moneda: z.string().optional(),
  categoria: z.string().max(100).optional().or(z.literal("")),
  unidad: z.string().max(50).optional().or(z.literal("")),
  imagenUrl: z.string().url("La URL de la imagen no es válida").optional().or(z.literal("")),
  activo: z.boolean().optional(),
  manejaStock: z.boolean().optional(),
  cantidadDisponible: z.number().min(0, "La cantidad debe ser mayor o igual a 0").optional(),
});

export const ActualizarProductoSchema = CrearProductoSchema.partial();

export type CrearProductoInput = z.infer<typeof CrearProductoSchema>;
export type ActualizarProductoInput = z.infer<typeof ActualizarProductoSchema>;
