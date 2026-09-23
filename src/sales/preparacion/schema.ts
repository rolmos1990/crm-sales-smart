import { z } from "zod";

export const EstadoPreparacionSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  color: z.string().trim().max(30).optional().or(z.literal("")),
  esInicial: z.boolean().default(false),
  marcaInicio: z.boolean().default(false),
  esFinal: z.boolean().default(false),
});

/** Edición inline de una columna: solo nombre y color. Las marcas
 *  (esInicial/marcaInicio/esFinal) NO viajan desde el cliente — así una
 *  edición de nombre no puede desmarcar el estado inicial o final por accidente. */
export const EditarColumnaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  color: z.string().trim().max(30).optional().or(z.literal("")),
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
export type EditarColumnaInput = z.infer<typeof EditarColumnaSchema>;
export type AvanceLineaInput = z.infer<typeof AvanceLineaSchema>;
export type PreferenciasTableroInput = z.infer<typeof PreferenciasTableroSchema>;
export type EtapasEntradaInput = z.infer<typeof EtapasEntradaSchema>;
export type NotaPreparacionInput = z.infer<typeof NotaPreparacionSchema>;
export type OrdenEstadosInput = z.infer<typeof OrdenEstadosSchema>;
export type FiltrosTableroInput = z.infer<typeof FiltrosTableroSchema>;

const fechaYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

/**
 * Filtros del tablero tal como los elige el usuario. Viven en estado de
 * cliente, no en la URL: al entrar al módulo siempre se arranca de
 * `FILTROS_VISTA_PREPARACION_DEFECTO`. Las fechas viajan como día de
 * calendario "YYYY-MM-DD" y el servidor las resuelve en la zona de negocio.
 */
export const FiltrosVistaPreparacionSchema = z.object({
  rango: z.enum(["HOY", "MANANA", "SEMANA", "PERSONALIZADO"]),
  desde: fechaYmd,
  hasta: fechaYmd,
  q: z.string().trim().max(200).nullable(),
  /** Paginación por columna: solo las que el usuario expandió más allá del
   *  default (clave = estadoId). */
  limites: z.record(z.string(), z.number().int().positive().max(10_000)),
});

export type FiltrosVistaPreparacion = z.infer<typeof FiltrosVistaPreparacionSchema>;

export const FILTROS_VISTA_PREPARACION_DEFECTO: FiltrosVistaPreparacion = {
  rango: "HOY",
  desde: null,
  hasta: null,
  q: null,
  limites: {},
};
