import { z } from "zod";

export const ConfiguracionTonoSchema = z.object({
  tono: z.enum(["Cálido", "Profesional", "Directo", "Empático", "Entusiasta"]).nullable().optional(),
  formalidad: z.enum(["Formal", "Semi Formal", "Informal"]).nullable().optional(),
  usoEmojis: z.boolean().optional(),
  respuestaLarga: z.boolean().optional(),
  llamaClientePorNombre: z.boolean().optional(),
  tuteo: z.boolean().optional(),
  usaHumor: z.boolean().optional(),
});

export type ConfiguracionTonoInput = z.infer<typeof ConfiguracionTonoSchema>;

export const AgenteIAConfigSchema = z.object({
  sistemaPrompt: z.string().optional(),
  personalidad: z.string().max(100).optional(),
  objetivo: z.string().max(300).optional(),
  especialidad: z.string().max(100).optional(),
  temperaturaOverride: z.number().min(0).max(2).nullable().optional(),
  modeloPreferido: z.string().max(100).optional(),
  memoriaHabilitada: z.boolean(),
  limiteTokensCtx: z.number().int().min(1000).max(100000),
  canalesPermitidos: z.array(z.string()).nullable().optional(),
  herramientas: z.array(z.string()).nullable().optional(),
  configuracionTono: ConfiguracionTonoSchema.nullable().optional(),
});

export type AgenteIAConfigInput = z.infer<typeof AgenteIAConfigSchema>;
