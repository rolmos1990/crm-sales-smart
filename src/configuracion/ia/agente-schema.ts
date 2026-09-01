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

// 009-perfil-agente-estructurado-versionado — dimensiones nuevas de identidad,
// comunicación y reglas. Todas opcionales: un agente sin ninguna configurada
// mantiene el comportamiento exacto que ya tenía (ver construirSystemPrompt).
export const LongitudRespuestaSchema = z.enum(["CORTA", "MEDIA", "LARGA"]);
export const ProactividadSchema = z.enum(["BAJA", "MEDIA", "ALTA"]);
export const IntensidadComercialSchema = z.enum(["SUAVE", "MODERADA", "DIRECTA"]);
export const EstiloRecomendacionSchema = z.enum(["CONSULTIVO", "DIRECTO", "COMPARATIVO"]);

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

  // Identidad (FR-001)
  nombreAgente: z.string().max(100).nullable().optional(),
  rol: z.string().max(200).nullable().optional(),
  idiomaPrincipal: z.string().max(10).nullable().optional(),
  idiomasPermitidos: z.array(z.string().max(10)).nullable().optional(),

  // Comunicación (FR-002)
  longitudRespuesta: LongitudRespuestaSchema.nullable().optional(),
  proactividad: ProactividadSchema.nullable().optional(),
  intensidadComercial: IntensidadComercialSchema.nullable().optional(),
  estiloRecomendacion: EstiloRecomendacionSchema.nullable().optional(),

  // Reglas y límites (FR-003, FR-004)
  frasesPreferidas: z.array(z.string().max(200)).nullable().optional(),
  frasesProhibidas: z.array(z.string().max(200)).nullable().optional(),
  comportamientosProhibidos: z.array(z.string().max(300)).nullable().optional(),
  reglasPersonalizadas: z.array(z.string().max(300)).nullable().optional(),
  condicionesTransferenciaHumano: z.array(z.string().max(300)).nullable().optional(),
});

export type AgenteIAConfigInput = z.infer<typeof AgenteIAConfigSchema>;
