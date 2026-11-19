import { z } from "zod";

export const MAX_SELECCION_ANALISIS = 100;

const id = z.string().min(1).max(64);

export const AnalizarContactoSchema = z.object({ contactoId: id });

export const ResolverSugerenciaSchema = z.object({
  contactoId: id,
  decision: z.enum(["ACEPTAR", "DESCARTAR"]),
});

export const AnalizarSeleccionadosSchema = z.object({
  contactoIds: z
    .array(id)
    .min(1, "Seleccioná al menos un contacto")
    .max(MAX_SELECCION_ANALISIS, `Se pueden analizar hasta ${MAX_SELECCION_ANALISIS} contactos por vez; para más, usá el análisis por segmento`),
});

export type ResolverSugerenciaEntrada = z.infer<typeof ResolverSugerenciaSchema>;
