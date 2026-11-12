import { z } from "zod";

export const CrearEtiquetaProductoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido").max(40, "Máximo 40 caracteres"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
    .optional()
    .or(z.literal("")),
});

export const ActualizarEtiquetaProductoSchema = CrearEtiquetaProductoSchema.partial();

export type CrearEtiquetaProductoInput = z.infer<typeof CrearEtiquetaProductoSchema>;
