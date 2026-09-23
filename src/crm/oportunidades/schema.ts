import { z } from "zod";

export const CrearOportunidadSchema = z.object({
  titulo: z.string().min(1, "El título es requerido").max(200),
  valor: z.number().min(0, "El valor debe ser mayor o igual a 0"),
  moneda: z.string().optional(),
  etapa: z.enum(["PROSPECTO", "CALIFICADO", "PROPUESTA", "NEGOCIACION", "GANADO", "PERDIDO"]).optional(),
  probabilidad: z.number().min(0).max(100).optional(),
  fechaCierre: z.date().optional(),
  notas: z.string().max(2000).optional().or(z.literal("")),
  empresaId: z.string().optional().or(z.literal("")),
  contactoId: z.string().optional().or(z.literal("")),
  pipelineId: z.string().optional().or(z.literal("")),
  stageId: z.string().optional().or(z.literal("")),
  tagIds: z.array(z.string()).optional(),
});

export const CambiarEtapaSchema = z.object({
  etapa: z.enum(["PROSPECTO", "CALIFICADO", "PROPUESTA", "NEGOCIACION", "GANADO", "PERDIDO"]),
  motivoPerdida: z.string().optional(),
});

export const ActualizarOportunidadSchema = CrearOportunidadSchema.partial();

export type CrearOportunidadInput = z.infer<typeof CrearOportunidadSchema>;
export type ActualizarOportunidadInput = z.infer<typeof ActualizarOportunidadSchema>;
export type CambiarEtapaInput = z.infer<typeof CambiarEtapaSchema>;

/** Filtros de la lista, en el mismo formato clave → string que tenían en la
 *  URL. Viven en estado de cliente; nunca se escriben en la URL. */
export const FiltrosVistaOportunidadesSchema = z.record(z.string().max(40), z.string().max(2000));
