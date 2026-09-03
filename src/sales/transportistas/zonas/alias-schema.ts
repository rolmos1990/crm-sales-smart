import { z } from "zod";

// 024-alias-ubicaciones-transportistas (FR-002) — `campo` es opcional: si no
// se especifica, el server action lo infiere como el nivel más específico no
// vacío del destino (mismo criterio que construirNombreVisible).
export const CrearAliasUbicacionSchema = z.object({
  zonaEntregaUbicacionId: z.string().min(1),
  campo: z.enum(["PROVINCIA_ESTADO", "DISTRITO_CIUDAD", "CORREGIMIENTO", "SECTOR_O_CODIGO_POSTAL"]).optional(),
  valor: z.string().trim().min(1, "El alias no puede estar vacío").max(150),
});

export type CrearAliasUbicacionInput = z.infer<typeof CrearAliasUbicacionSchema>;
