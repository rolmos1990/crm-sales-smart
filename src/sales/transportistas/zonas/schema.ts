import { z } from "zod";

// 022-transportistas-zonas-tarifas — país obligatorio (FR-010); el resto de
// niveles es texto libre opcional, vacío = comodín en la resolución
// (research.md Decisión 2/3, contracts/server-actions.md).
export const UbicacionZonaSchema = z.object({
  paisId: z.string().min(1, "Selecciona un país"),
  provinciaEstado: z.string().max(150).optional().or(z.literal("")),
  distritoCiudad: z.string().max(150).optional().or(z.literal("")),
  corregimiento: z.string().max(150).optional().or(z.literal("")),
  sectorOCodigoPostal: z.string().max(150).optional().or(z.literal("")),
});

export const CrearZonaEntregaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  descripcion: z.string().max(300).optional().or(z.literal("")),
  ubicaciones: z.array(UbicacionZonaSchema).min(1, "Agrega al menos una ubicación"),
});

export type UbicacionZonaInput = z.infer<typeof UbicacionZonaSchema>;
export type CrearZonaEntregaInput = z.infer<typeof CrearZonaEntregaSchema>;
