import { z } from "zod";

// 022-transportistas-zonas-tarifas — costo/precio nunca negativos (FR-024);
// que precioCliente < costoInterno se advierte pero no se bloquea (FR-025,
// ver actions.ts), así que acá no se valida esa relación.
export const CrearTarifaSchema = z.object({
  transportistaId: z.string().min(1),
  zonaEntregaId: z.string().min(1, "Selecciona una zona"),
  servicioTransportistaId: z.string().min(1, "Selecciona un servicio"),
  costoInterno: z.number().min(0, "El costo interno debe ser mayor o igual a 0"),
  precioCliente: z.number().min(0, "El precio al cliente debe ser mayor o igual a 0"),
  tiempoMinimoDias: z.number().int().min(0).optional().nullable(),
  tiempoMaximoDias: z.number().int().min(0).optional().nullable(),
  vigenteDesde: z.date().optional().nullable(),
  vigenteHasta: z.date().optional().nullable(),
});

export const EditarTarifaSchema = CrearTarifaSchema.omit({ transportistaId: true }).extend({
  id: z.string().min(1),
});

export const CambioMasivoSchema = z.object({
  transportistaId: z.string().min(1),
  servicioTransportistaId: z.string().min(1),
  zonaEntregaIds: z.array(z.string().min(1)).min(1, "Selecciona al menos una zona"),
  cambios: z.object({
    precioCliente: z.number().min(0).optional(),
    costoInterno: z.number().min(0).optional(),
    activa: z.boolean().optional(),
  }),
  crearSiNoExiste: z.boolean().optional(),
});

export type CrearTarifaInput = z.infer<typeof CrearTarifaSchema>;
export type EditarTarifaInput = z.infer<typeof EditarTarifaSchema>;
export type CambioMasivoInput = z.infer<typeof CambioMasivoSchema>;
