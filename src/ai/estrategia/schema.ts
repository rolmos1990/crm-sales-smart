import { z } from "zod";

const TIPOS_RELACION = [
  "NUEVO_CONTACTO",
  "PROSPECTO_RECURRENTE",
  "CLIENTE_NUEVO",
  "CLIENTE_REGULAR",
  "CLIENTE_INACTIVO",
  "CLIENTE_CON_INCIDENCIA",
] as const;

const INTENCIONES_COMERCIALES = [
  "EXPLORANDO",
  "COMPARANDO",
  "SOLICITANDO_RECOMENDACION",
  "CONSULTANDO_PRECIO",
  "CONSULTANDO_DISPONIBILIDAD",
  "LISTO_PARA_COTIZAR",
  "LISTO_PARA_COMPRAR",
  "ESPERANDO_INFORMACION",
  "REQUIERE_SEGUIMIENTO",
  "REQUIERE_ATENCION_HUMANA",
] as const;

export const CondicionesSchema = z.object({
  tiposRelacion: z.array(z.enum(TIPOS_RELACION)).default([]),
  intenciones: z.array(z.enum(INTENCIONES_COMERCIALES)).default([]),
});

export const ContenidoPlaybookSchema = z.object({
  reglas: z.array(z.string().min(1)).min(1, "Agregá al menos una regla"),
});

export const PlaybookEstrategiaSchema = z.object({
  nombre: z.string().min(1).max(150),
  descripcion: z.string().max(500).optional(),
  contenido: ContenidoPlaybookSchema,
  condiciones: CondicionesSchema,
  prioridad: z.number().int().min(0).max(100).optional(),
});

export type CondicionesInput = z.infer<typeof CondicionesSchema>;
export type PlaybookEstrategiaInput = z.infer<typeof PlaybookEstrategiaSchema>;

export const AsignarEstrategiaSchema = z.object({
  agenteIAConfigId: z.string(),
  playbookEstrategiaId: z.string(),
  prioridadEfectiva: z.number().int().min(0).max(100).nullable().optional(),
  condicionesOverride: CondicionesSchema.nullable().optional(),
});
export type AsignarEstrategiaInput = z.infer<typeof AsignarEstrategiaSchema>;
