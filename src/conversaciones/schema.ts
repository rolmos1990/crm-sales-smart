import { z } from "zod";

export const EnviarMensajeSchema = z.object({
  conversacionId: z.string().cuid(),
  contenido: z.string().min(1).max(4096).optional(),
  tipo: z.enum(["TEXTO", "IMAGEN", "VIDEO", "AUDIO", "NOTA_VOZ", "DOCUMENTO", "PLANTILLA", "BOTON"]).default("TEXTO"),
  esNotaInterna: z.boolean().default(false),
  mediaUrl: z.string().url().optional(),
});

export const CrearConversacionSchema = z.object({
  contactoId: z.string().cuid(),
  cuentaCanalId: z.string().cuid(),
  instanciaId: z.string().cuid(),
  asunto: z.string().max(255).optional(),
  oportunidadId: z.string().cuid().optional(),
});

export type EnviarMensajeInput = z.infer<typeof EnviarMensajeSchema>;
export type CrearConversacionInput = z.infer<typeof CrearConversacionSchema>;
