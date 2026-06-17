import { z } from "zod";

export const SchemaCrearCampoImport = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
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
});

export const SchemaMapeoColumna = z.object({
  columnaArchivo: z.string(),
  accion: z.enum(["mapear", "crear", "ignorar"]),
  campoDestino: z.string().optional(),
  campoCreadoId: z.string().optional(),
});

export const SchemaImportarRegistros = z.object({
  entidad: z.enum([
    "CONTACTO",
    "EMPRESA",
    "OPORTUNIDAD",
    "PEDIDO",
    "PRODUCTO",
    "ACTIVIDAD",
  ]),
  archivoNombre: z.string(),
  archivoTipo: z.string(),
  archivoPeso: z
    .number()
    .int()
    .max(2 * 1024 * 1024, "El archivo no puede superar 2 MB"),
  registros: z.array(z.record(z.string(), z.unknown())).min(1),
  mapeos: z.array(SchemaMapeoColumna),
  estrategiaContacto: z.enum(["email", "telefono", "email_o_telefono"]).optional(),
  estrategiaEmpresa: z.enum(["ruc", "email", "telefono", "ruc_o_email"]).optional(),
});

export type ImportarRegistrosInput = z.infer<typeof SchemaImportarRegistros>;
export type CrearCampoImportInput = z.infer<typeof SchemaCrearCampoImport>;
