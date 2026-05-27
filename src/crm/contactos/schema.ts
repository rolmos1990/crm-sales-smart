import { z } from "zod";

export const CrearContactoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  apellido: z.string().min(1, "El apellido es requerido").max(100),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefonoPrincipal: z.string().max(30).optional().or(z.literal("")),
  telefonoSecundario: z.string().max(30).optional().or(z.literal("")),
  cargo: z.string().max(100).optional().or(z.literal("")),
  notas: z.string().max(2000).optional().or(z.literal("")),
  estado: z.enum(["ACTIVO", "INACTIVO", "LEAD"]).optional(),
  empresaId: z.string().optional().or(z.literal("")),
  tagIds: z.array(z.string()).optional(),
});

export const ActualizarContactoSchema = CrearContactoSchema.partial();

export type CrearContactoInput = z.infer<typeof CrearContactoSchema>;
export type ActualizarContactoInput = z.infer<typeof ActualizarContactoSchema>;
