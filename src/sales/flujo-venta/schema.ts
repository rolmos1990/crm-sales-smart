import { z } from "zod";

export const EtapaSchema = z.object({
  nombre:              z.string().min(1, "El nombre es requerido").max(80),
  descripcion:         z.string().max(300).optional().or(z.literal("")),
  color:               z.string().optional().or(z.literal("")),
  orden:               z.number().int().min(0),
  esInicial:           z.boolean().optional(),
  esFinal:             z.boolean().optional(),
  esCancelacion:       z.boolean().optional(),
  esSecuencial:        z.boolean().optional(),
  permiteEditarPedido: z.boolean().optional(),
  activo:              z.boolean().optional(),
  parentId:            z.string().nullable().optional(),
});

export const CondicionSchema = z.object({
  campo:    z.string().min(1),
  operador: z.enum(["IGUAL", "DIFERENTE", "MAYOR_QUE", "MENOR_QUE", "CONTIENE", "ES_VERDADERO", "ES_FALSO"]),
  valor:    z.string(),
});

export const ReglaSchema = z.object({
  nombre:        z.string().min(1, "El nombre es requerido").max(120),
  descripcion:   z.string().max(500).optional().or(z.literal("")),
  activo:        z.boolean().optional(),
  prioridad:     z.number().int().min(0),
  etapaDestinoId: z.string().min(1, "Selecciona una etapa destino"),
  condiciones:   z.array(CondicionSchema).min(1, "Agrega al menos una condición"),
});

export const FlujoVentaSchema = z.object({
  nombre:      z.string().min(1, "El nombre es requerido").max(120),
  descripcion: z.string().max(500).optional().or(z.literal("")),
  esDefault:   z.boolean().optional(),
});

export type EtapaInput = z.infer<typeof EtapaSchema>;
export type ReglaInput = z.infer<typeof ReglaSchema>;
export type FlujoVentaInput = z.infer<typeof FlujoVentaSchema>;
