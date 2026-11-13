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

const ZonaEntregaBaseSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  descripcion: z.string().max(300).optional().or(z.literal("")),
  ubicaciones: z.array(UbicacionZonaSchema).min(1, "Agrega al menos una ubicación"),
});

export const CrearZonaEntregaSchema = ZonaEntregaBaseSchema.extend({
  // Las zonas son de un transportista, no del catálogo de la empresa — ver
  // ZonaEntrega.transportistaId en schema.prisma. Solo al crear: editar no
  // puede mover una zona de un transportista a otro (sus tarifas y las
  // cotizaciones que la referencian quedarían apuntando a otro dueño).
  transportistaId: z.string().min(1, "Falta el transportista"),
});

// Al editar, cada ubicación viaja con su `id` cuando ya existe: la acción las
// reconcilia una por una en vez de borrarlas y recrearlas, porque
// AliasUbicacion cuelga de ZonaEntregaUbicacion con onDelete Cascade y
// recrearlas perdería los alias configurados para ese destino.
export const UbicacionZonaEdicionSchema = UbicacionZonaSchema.extend({
  id: z.string().min(1).optional(),
});

export const EditarZonaEntregaSchema = ZonaEntregaBaseSchema.extend({
  id: z.string().min(1),
  ubicaciones: z.array(UbicacionZonaEdicionSchema).min(1, "Agrega al menos una ubicación"),
});

export type UbicacionZonaInput = z.infer<typeof UbicacionZonaSchema>;
export type CrearZonaEntregaInput = z.infer<typeof CrearZonaEntregaSchema>;
export type UbicacionZonaEdicionInput = z.infer<typeof UbicacionZonaEdicionSchema>;
export type EditarZonaEntregaInput = z.infer<typeof EditarZonaEntregaSchema>;
