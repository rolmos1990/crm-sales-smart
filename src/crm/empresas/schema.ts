import { z } from "zod";

export const CrearEmpresaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(200),
  ruc: z.string().max(20).optional().or(z.literal("")),
  industria: z.string().max(100).optional().or(z.literal("")),
  tamano: z.enum(["micro", "pequena", "mediana", "grande"]).optional(),
  sitioWeb: z.string().url("URL inválida").optional().or(z.literal("")),
  telefono: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notas: z.string().max(2000).optional().or(z.literal("")),
});

export const ActualizarEmpresaSchema = CrearEmpresaSchema.partial();

export type CrearEmpresaInput = z.infer<typeof CrearEmpresaSchema>;
export type ActualizarEmpresaInput = z.infer<typeof ActualizarEmpresaSchema>;
