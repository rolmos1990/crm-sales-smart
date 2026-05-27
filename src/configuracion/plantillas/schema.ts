import { z } from "zod";

const aliasRegex = /^[a-z0-9_]+$/;

export function normalizarAlias(val: string): string {
  return val.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export const CrearPlantillaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  alias: z
    .string()
    .min(1, "El alias es requerido")
    .max(50)
    .refine((val) => aliasRegex.test(val) && val.length > 0, {
      message: "Solo letras minúsculas, números y guiones bajos (_)",
    }),
  descripcion: z.string().max(255).optional().or(z.literal("")),
  tipo: z.enum(["TEXTO", "TEXTO_IMAGEN"]),
  contenidoTexto: z.string().min(1, "El contenido es requerido").max(5000),
  imagenUrl: z
    .string()
    .max(2048)
    .optional()
    .refine(
      (v) => !v || v === "" || v.startsWith("/") || v.startsWith("http://") || v.startsWith("https://"),
      "URL de imagen inválida"
    )
    .or(z.literal("")),
  instanciaId: z.string().min(1),
});

export const ActualizarPlantillaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100).optional(),
  alias: z
    .string()
    .min(1)
    .max(50)
    .refine((val) => aliasRegex.test(val), {
      message: "Solo letras minúsculas, números y guiones bajos (_)",
    })
    .optional(),
  descripcion: z.string().max(255).optional().or(z.literal("")),
  tipo: z.enum(["TEXTO", "TEXTO_IMAGEN"]).optional(),
  contenidoTexto: z.string().min(1, "El contenido es requerido").max(5000).optional(),
  imagenUrl: z
    .string()
    .max(2048)
    .optional()
    .refine(
      (v) => !v || v === "" || v.startsWith("/") || v.startsWith("http://") || v.startsWith("https://"),
      "URL de imagen inválida"
    )
    .or(z.literal("")),
});

export type CrearPlantillaInput = z.infer<typeof CrearPlantillaSchema>;
export type ActualizarPlantillaInput = z.infer<typeof ActualizarPlantillaSchema>;
