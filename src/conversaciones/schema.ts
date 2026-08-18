import { z } from "zod";

export const EnviarMensajeSchema = z.object({
  conversacionId: z.string().cuid2(),
  // "" se normaliza a undefined: un mensaje puede ser solo imagen sin texto
  // (ej. plantilla con imagen y sin contenido), .min(1) rechazaría eso.
  contenido: z
    .string()
    .max(4096)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  tipo: z.enum(["TEXTO", "IMAGEN", "VIDEO", "AUDIO", "NOTA_VOZ", "DOCUMENTO", "PLANTILLA", "BOTON"]).default("TEXTO"),
  esNotaInterna: z.boolean().default(false),
  // Acepta tanto URLs absolutas (https://...) como rutas relativas (/uploads/...)
  // La resolución a URL absoluta ocurre en el worker usando APP_URL del .env
  mediaUrl: z.string().optional(),
});

export const CrearConversacionSchema = z.object({
  contactoId: z.string().cuid2(),
  cuentaCanalId: z.string().cuid2(),
  instanciaId: z.string().cuid2(),
  asunto: z.string().max(255).optional(),
  oportunidadId: z.string().cuid2().optional(),
});

export type EnviarMensajeInput = z.infer<typeof EnviarMensajeSchema>;
export type CrearConversacionInput = z.infer<typeof CrearConversacionSchema>;
