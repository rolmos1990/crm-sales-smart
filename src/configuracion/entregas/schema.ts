import { z } from "zod";

const METODOS_ENTREGA = [
  "COURIER_EXTERNO",
  "MENSAJERO_PROPIO",
  "RETIRO_TIENDA",
  "DIGITAL",
  "INSTALACION_SERVICIO",
] as const;

export const MetodoEntregaConfigSchema = z.object({
  metodoEntrega: z.enum(METODOS_ENTREGA),
  activo: z.boolean().default(true),
  costoBase: z.number().min(0),
  diasEstimadosMin: z.number().int().min(0).nullable().optional(),
  diasEstimadosMax: z.number().int().min(0).nullable().optional(),
});
export type MetodoEntregaConfigInput = z.infer<typeof MetodoEntregaConfigSchema>;

export const ZonaCoberturaSchema = z.object({
  nombre: z.string().min(1).max(120),
});
export type ZonaCoberturaInput = z.infer<typeof ZonaCoberturaSchema>;

export const ZonaCoberturaMetodoSchema = z.object({
  zonaCoberturaId: z.string(),
  metodoEntregaConfigId: z.string(),
  cubierta: z.boolean().default(true),
  costoAdicional: z.number().min(0).default(0),
  diasAdicionales: z.number().int().min(0).default(0),
});
export type ZonaCoberturaMetodoInput = z.infer<typeof ZonaCoberturaMetodoSchema>;

export const UbicacionRetiroSchema = z.object({
  nombre: z.string().min(1).max(150),
  direccion: z.string().min(1).max(300),
  activo: z.boolean().default(true),
});
export type UbicacionRetiroInput = z.infer<typeof UbicacionRetiroSchema>;
