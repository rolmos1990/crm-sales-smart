import { z } from "zod";

// Max delay: 600 unidades. Max unidad = meses (30*24*60 = 43200 min). 600*43200 = 25_920_000
// Min delay cuando es programado: 5 minutos
const MAX_DELAY_MINUTOS = 25_920_000;
const MIN_DELAY_MINUTOS = 5;

export const SchemaDisparadorBase = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(120),
  activo: z.boolean().default(true),
  delayMinutos: z
    .number()
    .int("El tiempo debe ser un número entero")
    .min(MIN_DELAY_MINUTOS, `El tiempo mínimo es ${MIN_DELAY_MINUTOS} minutos`)
    .max(MAX_DELAY_MINUTOS)
    .nullable()
    .default(null),
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

export const SchemaAsignarEtiqueta = SchemaDisparadorBase.extend({
  tipo: z.literal("ASIGNAR_ETIQUETA"),
  config: z.object({
    tagId: z.string().min(1, "La etiqueta es requerida"),
    tagNombre: z.string().optional(),
  }),
});

export const SchemaModificarCampo = SchemaDisparadorBase.extend({
  tipo: z.literal("MODIFICAR_CAMPO"),
  config: z.object({
    modo: z.enum(["campo_directo", "metadata"]),
    clave: z.string().min(1, "La clave del campo es requerida").max(100),
    valor: z.string().max(500),
  }),
});

export const SchemaCambiarEtapa = SchemaDisparadorBase.extend({
  tipo: z.literal("CAMBIAR_ETAPA"),
  config: z.object({
    pipelineId: z.string().min(1, "El pipeline es requerido"),
    stageId: z.string().min(1, "La etapa es requerida"),
    pipelineNombre: z.string().optional(),
    stageNombre: z.string().optional(),
  }),
});

export const SchemaCerrarOportunidad = SchemaDisparadorBase.extend({
  tipo: z.literal("CERRAR_OPORTUNIDAD"),
  config: z.object({
    resultado: z.enum(["GANADA", "PERDIDA"]),
  }),
});

export const SchemaDisparador = z.discriminatedUnion("tipo", [
  SchemaCrearTarea,
  SchemaCrearNota,
  SchemaWebhook,
  SchemaAsignarUsuario,
  SchemaAsignarEtiqueta,
  SchemaModificarCampo,
  SchemaCambiarEtapa,
  SchemaCerrarOportunidad,
]);

export type DatosDisparador = z.infer<typeof SchemaDisparador>;
