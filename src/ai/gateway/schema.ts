import { z } from "zod";

const MensajeIASchema = z.object({
  rol: z.enum(["system", "user", "assistant"]),
  contenido: z.string().min(1),
});

export const SolicitudIASchema = z.object({
  instanciaId: z.string().cuid(),
  agenteIAConfigId: z.string().cuid().optional(),
  tarea: z.enum(["CHAT", "RESUMEN", "CLASIFICACION", "SENTIMIENTO", "EXTRACCION_ENTIDADES", "REPORTE", "EMBEDDINGS"]),
  mensajes: z.array(MensajeIASchema).min(1),
  temperatura: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(8096).optional(),
  entidadTipo: z.string().optional(),
  entidadId: z.string().optional(),
});

export type SolicitudIAInput = z.infer<typeof SolicitudIASchema>;
