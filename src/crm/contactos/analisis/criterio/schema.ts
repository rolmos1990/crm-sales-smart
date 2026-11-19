import { z } from "zod";

/**
 * 042 — Contenido del criterio de análisis de una cuenta (contracts/criterio.md).
 *
 * Las instrucciones viajan al modelo dentro de `<criterio_negocio>`; no pueden
 * contener esa etiqueta ni la de los datos, porque permitirían "cerrar" el
 * bloque y escribir fuera de él (riesgo R6).
 */

export const LARGO_MAXIMO_INSTRUCCIONES = 2000;
const ETIQUETAS_RESERVADAS = /<\/?\s*(criterio_negocio|datos_lote)\s*>/i;

const item = z.string().trim().min(3).max(120);

export const UmbralesSchema = z.object({
  comprasRecurrente: z.number().int().min(2).max(50),
  diasInactivo: z.number().int().min(15).max(730),
});

export const PesosSchema = z
  .object({
    compras: z.number().min(0).max(1),
    recencia: z.number().min(0).max(1),
    documentosAbiertos: z.number().min(0).max(1),
    actividadAgendada: z.number().min(0).max(1),
    esperaRespuesta: z.number().min(0).max(1),
  })
  .refine((p) => Math.abs(p.compras + p.recencia + p.documentosAbiertos + p.actividadAgendada + p.esperaRespuesta - 1) <= 0.001, {
    message: "Los pesos deben sumar 1",
  });

export const CriterioContenidoSchema = z.object({
  instrucciones: z
    .string()
    .max(LARGO_MAXIMO_INSTRUCCIONES, `Las instrucciones no pueden superar ${LARGO_MAXIMO_INSTRUCCIONES} caracteres`)
    .refine((t) => !ETIQUETAS_RESERVADAS.test(t), { message: "Las instrucciones contienen etiquetas reservadas" }),
  senalesCompra: z.array(item).max(15),
  objecionesTipicas: z.array(item).max(15),
  umbrales: UmbralesSchema,
  pesos: PesosSchema,
});

export type CriterioContenido = z.infer<typeof CriterioContenidoSchema>;
export type UmbralesCriterio = z.infer<typeof UmbralesSchema>;
export type PesosCriterio = z.infer<typeof PesosSchema>;

export const PLANTILLAS_CRITERIO = ["GENERAL", "RETAIL", "SERVICIOS", "B2B"] as const;
export type PlantillaCriterio = (typeof PLANTILLAS_CRITERIO)[number];
