import { z } from "zod";

/** 042 — Interruptores mínimos (FR-030a): llegan con la misma entrega que activa la IA. */
export const InterruptoresAnalisisSchema = z.object({
  habilitado: z.boolean(),
  historicoPausado: z.boolean(),
});
export type InterruptoresAnalisis = z.infer<typeof InterruptoresAnalisisSchema>;

/**
 * Configuración completa por cuenta (contracts/server-actions.md). `peso` NO
 * está: lo ajusta el equipo de Karia, nunca la cuenta.
 */
export const ConfiguracionAnalisisSchema = InterruptoresAnalisisSchema.extend({
  modoInteres: z.enum(["SOLO_SUGERIR", "APLICAR_AUTOMATICO"]),
  mesesAntiguedadInicial: z.number().int().min(1).max(60),
  tamanoLote: z.number().int().min(1).max(50),
  maxLotesSimultaneos: z.number().int().min(1).max(10),
  presupuestoDiarioCosto: z.number().positive().max(100_000).nullable(),
  presupuestoDiarioTokens: z.number().int().positive().max(1_000_000_000).nullable(),
  ventanaAgrupacionSeg: z.number().int().min(0).max(3600),
  esperaMaximaSeg: z.number().int().min(0).max(24 * 3600),
}).refine((c) => c.esperaMaximaSeg >= c.ventanaAgrupacionSeg, {
  message: "La espera máxima no puede ser menor que la ventana de agrupación",
  path: ["esperaMaximaSeg"],
});
export type ConfiguracionAnalisis = z.infer<typeof ConfiguracionAnalisisSchema>;

export const CONFIGURACION_ANALISIS_DEFECTO: ConfiguracionAnalisis = {
  habilitado: true,
  historicoPausado: false,
  modoInteres: "SOLO_SUGERIR",
  mesesAntiguedadInicial: 12,
  tamanoLote: 20,
  maxLotesSimultaneos: 1,
  presupuestoDiarioCosto: null,
  presupuestoDiarioTokens: null,
  ventanaAgrupacionSeg: 300,
  esperaMaximaSeg: 1800,
};
