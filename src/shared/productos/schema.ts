import { z } from "zod";

// Plantilla de entrega digital — solo relevante cuando tipo = DIGITAL. Sin
// campo `codigo` real: el cliente solo puede pedir "conservar" o
// "reemplazar" (ver src/shared/lib/codigo-sensible.ts) — nunca manda ni
// recibe el valor existente. Sin campos obligatorios a propósito.
export const EntregaDigitalProductoSchema = z.object({
  metodo: z.enum(["EMAIL", "LINK", "DESCARGA", "ACCESO", "LICENCIA", "MANUAL", "OTRO"]).optional(),
  url: z.string().max(500).optional().or(z.literal("")),
  archivo: z.string().max(500).optional().or(z.literal("")),
  usuarioAcceso: z.string().max(200).optional().or(z.literal("")),
  instrucciones: z.string().max(500).optional().or(z.literal("")),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  requiereSeguimiento: z.boolean().optional(),
  tipoSeguimiento: z.string().max(100).optional().or(z.literal("")),
  codigoAccion: z.enum(["CONSERVAR", "REEMPLAZAR"]).optional(),
  codigoNuevo: z.string().max(200).optional().or(z.literal("")),
});

export const CrearProductoSchema = z.object({
  sku: z.string().max(100).optional().or(z.literal("")),
  nombre: z.string().min(1, "El nombre es requerido").max(200),
  descripcion: z.string().max(1000).optional().or(z.literal("")),
  precio: z.number({ error: "El precio es requerido" }).min(0, "El precio debe ser mayor o igual a 0"),
  moneda: z.string().optional(),
  categoria: z.string().max(100).optional().or(z.literal("")),
  tipo: z.enum(["FISICO", "SERVICIO", "DIGITAL"]).optional(),
  unidad: z.string().max(50).optional().or(z.literal("")),
  imagenUrl: z
    .string()
    .optional()
    .refine(
      (v) => !v || v === "" || v.startsWith("/") || v.startsWith("http://") || v.startsWith("https://"),
      "La URL de la imagen no es válida"
    )
    .or(z.literal("")),
  activo: z.boolean().optional(),
  manejaStock: z.boolean().optional(),
  cantidadDisponible: z
    .number({ error: "Ingresa una cantidad válida" })
    .min(0, "La cantidad debe ser mayor o igual a 0")
    .optional(),
  // Solo se persiste cuando tipo = DIGITAL (ver actions.ts).
  entregaDigital: EntregaDigitalProductoSchema.optional(),
});

export const ActualizarProductoSchema = CrearProductoSchema.partial();

export type CrearProductoInput = z.infer<typeof CrearProductoSchema>;
export type ActualizarProductoInput = z.infer<typeof ActualizarProductoSchema>;
export type EntregaDigitalProductoInput = z.infer<typeof EntregaDigitalProductoSchema>;
