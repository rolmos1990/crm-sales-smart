import { z } from "zod";

export const CrearTagSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(50),
  color: z.string().optional().or(z.literal("")),
});

export const ActualizarTagSchema = CrearTagSchema.partial();

export type CrearTagInput = z.infer<typeof CrearTagSchema>;
export type ActualizarTagInput = z.infer<typeof ActualizarTagSchema>;
