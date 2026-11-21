import { z } from "zod";
import { PROVEEDORES_VOZ_IMPLEMENTADOS } from "@/voz/proveedores/disponibles";

/**
 * 049 — Validación del alta y la edición de un Proveedor de Voz.
 *
 * El enum se deriva de `PROVEEDORES_VOZ_IMPLEMENTADOS`, no del enum de Prisma:
 * así el formulario no puede ofrecer un proveedor que todavía no tiene
 * adaptador. En IA eso se chequea aparte dentro de la action; acá lo impide el
 * tipo.
 */
const ProveedorVozEnumSchema = z.enum(PROVEEDORES_VOZ_IMPLEMENTADOS);

export const ProveedorVozSchema = z.object({
  alias: z.string().trim().min(1, "El alias es obligatorio").max(50, "Máximo 50 caracteres"),
  proveedor: ProveedorVozEnumSchema,
  // Vacío al editar significa "conservar la vigente" (FR-003). La action lo
  // interpreta; acá solo se admite.
  apiKey: z.string().min(1, "La API key es requerida").optional().or(z.literal("")),
  baseUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  modelo: z.string().trim().min(1, "El modelo es obligatorio"),
  prioridad: z.number().int().min(1).max(10),
  // Precio del proveedor, en la moneda en que factura. Nunca se asume: sin
  // esto, el costo estimado queda en blanco en vez de inventarse.
  costoPorHora: z.number().min(0).optional().nullable(),
  limiteMinutosDia: z.number().int().positive().optional().nullable(),
  timeoutMs: z.number().int().min(1000).max(120000),
  reintentosMax: z.number().int().min(0).max(5),
});

export type ProveedorVozInput = z.infer<typeof ProveedorVozSchema>;

// El proveedor subyacente es inmutable tras la creación: cambiarlo sobre una
// fila existente dejaría la credencial de un servicio apuntando a otro.
export const ActualizarProveedorVozSchema = ProveedorVozSchema.omit({ proveedor: true });
export type ActualizarProveedorVozInput = z.infer<typeof ActualizarProveedorVozSchema>;

export const TranscripcionVozHabilitadaSchema = z.object({
  habilitada: z.boolean(),
});
