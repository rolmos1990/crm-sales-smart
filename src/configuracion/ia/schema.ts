import { z } from "zod";

export const ConfiguracionIASchema = z.object({
  habilitado: z.boolean(),
  proveedorDefault: z.enum(["ANTHROPIC", "OPENAI", "GEMINI", "DEEPSEEK", "LOCAL"]).optional(),
  modeloDefault: z.string().min(1).optional(),
  temperaturaDefault: z.number().min(0).max(2).optional(),
  limiteTokensDiarios: z.number().int().positive().optional().nullable(),
  limiteTokensMensual: z.number().int().positive().optional().nullable(),
  fallbackHabilitado: z.boolean(),
});

export type ConfiguracionIAInput = z.infer<typeof ConfiguracionIASchema>;

export const ProveedorIASchema = z.object({
  proveedor: z.enum(["ANTHROPIC", "OPENAI", "GEMINI", "DEEPSEEK", "LOCAL"]),
  tipoAgenteIA: z.enum(["COMERCIAL", "GERENCIA"]).nullable().optional(),
  apiKey: z.string().min(1, "La API key es requerida").optional().or(z.literal("")),
  baseUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  modelosDisponibles: z.string().min(1, "Ingresa al menos un modelo"),
  prioridad: z.number().int().min(1).max(10),
  limitePorMinuto: z.number().int().positive().optional().nullable(),
  limitePorDia: z.number().int().positive().optional().nullable(),
  timeoutMs: z.number().int().min(1000).max(120000),
  reintentosMax: z.number().int().min(0).max(5),
});

export type ProveedorIAInput = z.infer<typeof ProveedorIASchema>;
