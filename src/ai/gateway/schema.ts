import { z } from "zod";

const MensajeIASchema = z.object({
  rol: z.enum(["system", "user", "assistant"]),
  contenido: z.string().min(1),
});

export const SolicitudIASchema = z.object({
  instanciaId: z.string().cuid(),
  agenteIAConfigId: z.string().cuid().optional(),
  tarea: z.enum([
    "CHAT",
    "RESUMEN",
    "CLASIFICACION",
    "SENTIMIENTO",
    "EXTRACCION_ENTIDADES",
    "REPORTE",
    "EMBEDDINGS",
    // 010-enrutamiento-modelos-ia-por-objetivo
    "IDENTIFICACION_PRODUCTO",
    // 042-contactos-analisis-ia
    "ANALISIS_CONTACTOS",
  ]),
  mensajes: z.array(MensajeIASchema).min(1),
  temperatura: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(8096).optional(),
  entidadTipo: z.string().optional(),
  entidadId: z.string().optional(),
  // 010-enrutamiento-modelos-ia-por-objetivo — solo aplica cuando tarea === "CHAT"
  requiereRazonamientoSuperior: z.boolean().optional(),
  formatoRespuesta: z.literal("json").optional(),
});

export type SolicitudIAInput = z.infer<typeof SolicitudIASchema>;
