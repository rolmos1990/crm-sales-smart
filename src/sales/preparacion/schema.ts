import { z } from "zod";

export const EstadoPreparacionSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  color: z.string().trim().max(30).optional().or(z.literal("")),
  esInicial: z.boolean().default(false),
  marcaInicio: z.boolean().default(false),
  esFinal: z.boolean().default(false),
});

export const AvanceLineaSchema = z.object({
  pedidoLineaId: z.string().min(1),
  // El techo (<= cantidad de la línea) no se puede expresar acá: se valida en
  // servidor contra la línea real, que es la única fuente de verdad.
  cantidadPreparada: z.number().min(0, "La cantidad preparada no puede ser negativa"),
});

export const PreferenciasTableroSchema = z.object({
  agrupacionDefecto: z.enum(["POR_PEDIDO", "POR_PRODUCTO"]),
  rangoDefecto: z.enum(["HOY", "MANANA", "SEMANA", "PERSONALIZADO"]),
});

export const EtapasEntradaSchema = z.object({
  etapaIds: z.array(z.string().min(1)),
});

export const NotaPreparacionSchema = z.object({
  pedidoId: z.string().min(1),
  notas: z.string().trim().max(2000),
});

export const OrdenEstadosSchema = z.object({
  orden: z.array(z.object({ id: z.string().min(1), orden: z.number().int().min(0) })).min(1),
});

export const FiltrosTableroSchema = z.object({
  rango: z.enum(["HOY", "MANANA", "SEMANA", "PERSONALIZADO"]).default("HOY"),
  desde: z.date().optional(),
  hasta: z.date().optional(),
  busqueda: z.string().trim().max(200).optional(),
  agrupacion: z.enum(["POR_PEDIDO", "POR_PRODUCTO"]).optional(),
});

export type EstadoPreparacionInput = z.infer<typeof EstadoPreparacionSchema>;
export type AvanceLineaInput = z.infer<typeof AvanceLineaSchema>;
export type PreferenciasTableroInput = z.infer<typeof PreferenciasTableroSchema>;
export type EtapasEntradaInput = z.infer<typeof EtapasEntradaSchema>;
export type NotaPreparacionInput = z.infer<typeof NotaPreparacionSchema>;
export type OrdenEstadosInput = z.infer<typeof OrdenEstadosSchema>;
export type FiltrosTableroInput = z.infer<typeof FiltrosTableroSchema>;
