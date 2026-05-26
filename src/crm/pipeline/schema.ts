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
});

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
  requerido: z.boolean().default(false),
  bloqueado: z.boolean().default(false),
  descripcion: z.string().max(300).nullish(),
  opciones: z.array(z.string()).nullish(),
});
