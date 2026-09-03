import { z } from "zod";

// 024-alias-ubicaciones-transportistas — validación de una fila ya mapeada
// (columnas fijas del dominio, ver types.ts). Los campos numéricos llegan
// como texto desde el parseo de archivo (mismo criterio que src/crm/datos/)
// y se convierten acá.
export const FilaDestinoImportSchema = z.object({
  zonaNombre: z.string().trim().min(1, "Falta el nombre de la zona"),
  provinciaEstado: z.string().trim().min(1, "Falta la provincia/estado"),
  distritoCiudad: z.string().trim().optional().or(z.literal("")),
  corregimiento: z.string().trim().optional().or(z.literal("")),
  sectorOCodigoPostal: z.string().trim().optional().or(z.literal("")),
  alias: z.string().trim().optional().or(z.literal("")),
  servicioNombre: z.string().trim().min(1, "Falta el servicio"),
  costoInterno: z.coerce.number().min(0, "El costo no puede ser negativo"),
  precioCliente: z.coerce.number().min(0, "El precio no puede ser negativo"),
  tiempoMinimoDias: z.coerce.number().int().min(0).optional(),
  tiempoMaximoDias: z.coerce.number().int().min(0).optional(),
});

export type FilaDestinoImportInput = z.infer<typeof FilaDestinoImportSchema>;

export const RevisarImportacionDestinosSchema = z.object({
  transportistaId: z.string().min(1),
  paisId: z.string().min(1),
  filas: z.array(z.record(z.string(), z.string())).min(1, "El archivo no tiene filas"),
});

const DecisionFilaSchema = z.discriminatedUnion("incluir", [
  z.object({ incluir: z.literal(false) }),
  z.object({ incluir: z.literal(true), usarExistenteId: z.string().optional() }),
]);

export const ConfirmarImportacionDestinosSchema = z.object({
  transportistaId: z.string().min(1),
  paisId: z.string().min(1),
  archivoNombre: z.string().min(1),
  archivoTipo: z.string().min(1),
  archivoPeso: z.number().int().min(0),
  filas: z.array(z.record(z.string(), z.string())).min(1),
  decisiones: z.array(DecisionFilaSchema),
});
