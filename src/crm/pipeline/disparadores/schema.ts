import { z } from "zod";

export const SchemaDisparadorBase = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(120),
  activo: z.boolean().default(true),
  delayMinutos: z.number().int().min(0).max(10080).nullable().default(null),
});

export const SchemaCrearTarea = SchemaDisparadorBase.extend({
  tipo: z.literal("CREAR_TAREA"),
  config: z.object({
    titulo: z.string().min(1, "El título de la tarea es requerido").max(200),
    descripcion: z.string().max(500).optional(),
  }),
});

export const SchemaCrearNota = SchemaDisparadorBase.extend({
  tipo: z.literal("CREAR_NOTA"),
  config: z.object({
    contenido: z.string().min(1, "El contenido de la nota es requerido").max(1000),
  }),
});

export const SchemaWebhook = SchemaDisparadorBase.extend({
  tipo: z.literal("WEBHOOK"),
  config: z.object({
    url: z.string().min(1, "La URL es requerida").max(2000),
    method: z.enum(["POST", "GET"]).default("POST"),
    headers: z.record(z.string(), z.string()).optional(),
  }),
});

export const SchemaAsignarUsuario = SchemaDisparadorBase.extend({
  tipo: z.literal("ASIGNAR_USUARIO"),
  config: z.object({
    usuarioId: z.string().min(1, "El usuario es requerido"),
    usuarioNombre: z.string().optional(),
  }),
});

export const SchemaDisparador = z.discriminatedUnion("tipo", [
  SchemaCrearTarea,
  SchemaCrearNota,
  SchemaWebhook,
  SchemaAsignarUsuario,
]);

export type DatosDisparador = z.infer<typeof SchemaDisparador>;
