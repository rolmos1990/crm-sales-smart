import { z } from "zod";

export const CrearActividadSchema = z.object({
  tipo: z.enum(["LLAMADA", "EMAIL", "REUNION", "TAREA", "NOTA"]),
  titulo: z.string().min(1, "El título es requerido").max(200),
  descripcion: z.string().max(2000).optional().or(z.literal("")),
  fecha: z.date({ error: "La fecha es requerida" }),
  contactoId: z.string().optional().or(z.literal("")),
  empresaId: z.string().optional().or(z.literal("")),
  oportunidadId: z.string().optional().or(z.literal("")),
});

export const ActualizarActividadSchema = CrearActividadSchema.partial();

export type CrearActividadInput = z.infer<typeof CrearActividadSchema>;
export type ActualizarActividadInput = z.infer<typeof ActualizarActividadSchema>;
