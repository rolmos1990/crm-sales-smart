import { z } from "zod";

export const SchemaPipeline = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  descripcion: z.string().max(500).nullish(),
});

export const SchemaStage = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  color: z.string().max(20).nullish(),
  probabilidad: z.number().int().min(0).max(100).default(20),
  esGanado: z.boolean().default(false),
  esPerdido: z.boolean().default(false),
  // Solo tiene efecto cuando esGanado o esPerdido son true: oculta la etapa
  // como columna del kanban (sigue disponible para mover una oportunidad ahí).
  visible: z.boolean().default(true),
});

// Filtros del Pipeline — llegan como query params (strings) y se validan
// antes de construir el `where` de Prisma. Las fechas van en formato
// "yyyy-MM-dd" (fecha de calendario, sin hora) y `tags` es un CSV de tagIds.
export const SchemaFiltrosOportunidad = z.object({
  creadoDesde: z.string().trim().min(1).optional(),
  creadoHasta: z.string().trim().min(1).optional(),
  cierreDesde: z.string().trim().min(1).optional(),
  cierreHasta: z.string().trim().min(1).optional(),
  contactoId: z.string().trim().min(1).optional(),
  empresaId: z.string().trim().min(1).optional(),
  titulo: z.string().trim().min(1).max(200).optional(),
  tags: z.string().trim().min(1).optional(),
});

export type FiltrosOportunidadParams = z.infer<typeof SchemaFiltrosOportunidad>;

/** Claves de query params que representan un filtro del Pipeline. */
export const CLAVES_FILTROS_OPORTUNIDAD = [
  "creadoDesde",
  "creadoHasta",
  "cierreDesde",
  "cierreHasta",
  "contactoId",
  "empresaId",
  "titulo",
  "tags",
] as const;

export const SchemaCampoPersonalizado = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  clave: z
    .string()
    .min(1, "La clave es requerida")
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Solo letras minúsculas, números y guión bajo"),
  tipo: z.enum([
    "TEXTO",
    "TEXTO_LARGO",
    "NUMERO",
    "DECIMAL",
    "FECHA",
    "BOOLEANO",
    "SELECT",
    "MULTISELECT",
    "EMAIL",
    "TELEFONO",
    "URL",
  ]),
  descripcion: z.string().max(300).nullish(),
  opciones: z.array(z.string()).nullish(),
  visibleEn: z.array(z.string()).default([]),
  requeridoEn: z.array(z.string()).default([]),
  bloqueadoEn: z.array(z.string()).default([]),
});
