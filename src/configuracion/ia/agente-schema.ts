import { z } from "zod";

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
});

export type AgenteIAConfigInput = z.infer<typeof AgenteIAConfigSchema>;
