import { z } from "zod";

const METODOS_ENTREGA = [
  "COURIER_EXTERNO",
  "MENSAJERO_PROPIO",
  "RETIRO_TIENDA",
  "DIGITAL",
  "INSTALACION_SERVICIO",
] as const;

// 019-cobertura-geografica-envios — solo tiene efecto observable para
// métodos de delivery propio (no COURIER_EXTERNO). Default conservador
// (favorece revisión humana) igual criterio que gate.ts (spec 016).
export const MODOS_COBERTURA_DELIVERY = ["TODOS_LADOS_CON_EXCEPCIONES", "SOLO_ZONAS_EVALUADAS"] as const;

export const MetodoEntregaConfigSchema = z.object({
  metodoEntrega: z.enum(METODOS_ENTREGA),
  activo: z.boolean().default(true),
  costoBase: z.number().min(0),
  diasEstimadosMin: z.number().int().min(0).nullable().optional(),
  diasEstimadosMax: z.number().int().min(0).nullable().optional(),
  modoCobertura: z.enum(MODOS_COBERTURA_DELIVERY).default("SOLO_ZONAS_EVALUADAS"),
});
export type MetodoEntregaConfigInput = z.infer<typeof MetodoEntregaConfigSchema>;

export const ZonaCoberturaSchema = z.object({
  nombre: z.string().min(1).max(120),
});
export type ZonaCoberturaInput = z.infer<typeof ZonaCoberturaSchema>;

export const ZonaCoberturaMetodoSchema = z
  .object({
    zonaCoberturaId: z.string(),
    metodoEntregaConfigId: z.string(),
    cubierta: z.boolean().default(true),
    costoAdicional: z.number().min(0).default(0),
    diasAdicionales: z.number().int().min(0).default(0),
    // 019-cobertura-geografica-envios — excepción explícita cuando el
    // método está en modo TODOS_LADOS_CON_EXCEPCIONES. Mutuamente excluyente
    // con `cubierta = true` (FR-007, validado abajo).
    esExcepcion: z.boolean().default(false),
  })
  .refine((datos) => !(datos.esExcepcion && datos.cubierta), {
    message: "Una zona no puede ser cobertura y excepción a la vez",
    path: ["esExcepcion"],
  });
export type ZonaCoberturaMetodoInput = z.infer<typeof ZonaCoberturaMetodoSchema>;

export const UbicacionRetiroSchema = z.object({
  nombre: z.string().min(1).max(150),
  direccion: z.string().min(1).max(300),
  activo: z.boolean().default(true),
});
export type UbicacionRetiroInput = z.infer<typeof UbicacionRetiroSchema>;
