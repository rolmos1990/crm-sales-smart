// 035 — Forma de los datos de correo que viajan por el comando
// ProcesarEntrante y que se guardan en las columnas Json de MensajeCorreo.
//
// Sin imports de Next ni de Prisma: lo alcanza el worker (normalizar.ts).
// Se valida al escribir (procesarMensajeEntrante) y al leer (vista/queries.ts):
// las columnas Json no tienen tipo en la base, y un dato con forma inesperada
// no debe llegar ni a la vista ni al proxy de imágenes.
import { z } from "zod";

export const ESTADOS_HTML_CORREO = ["SIN_HTML", "DISPONIBLE", "NO_DISPONIBLE"] as const;

export const direccionCorreoSchema = z.object({
  nombre: z.string().max(300).nullable(),
  direccion: z.string().min(1).max(320),
});
export type DireccionCorreo = z.infer<typeof direccionCorreoSchema>;

export const adjuntoCorreoSchema = z.object({
  mediaArchivoId: z.string().min(1),
  nombre: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(255),
  bytes: z.number().int().nonnegative(),
  /** Content-ID sin "<>" y en minúsculas. */
  cid: z.string().min(1).max(500).nullable(),
  /** true si el HTML limpio lo usa como `cid:` — no se lista como adjunto. */
  enLinea: z.boolean(),
});
export type AdjuntoCorreo = z.infer<typeof adjuntoCorreoSchema>;

/** Solo http(s): es lo único que el proxy de imágenes acepta descargar. */
export const imagenesExternasSchema = z
  .array(z.string().max(4096).refine((u) => /^https?:\/\//i.test(u), "solo http(s)"))
  .max(50);

const listaDireccionesSchema = z.array(direccionCorreoSchema).max(50);

export const datosCorreoEntranteSchema = z
  .object({
    estadoHtml: z.enum(ESTADOS_HTML_CORREO),
    motivoHtml: z.string().max(64).nullable(),
    htmlLimpio: z.string().max(524_288).nullable(),
    versionPolitica: z.number().int().positive(),
    imagenesExternas: imagenesExternasSchema,
    adjuntos: z.array(adjuntoCorreoSchema).max(50),
    de: direccionCorreoSchema.nullable(),
    para: listaDireccionesSchema,
    paraTotal: z.number().int().nonnegative(),
    cc: listaDireccionesSchema,
    ccTotal: z.number().int().nonnegative(),
    asunto: z.string().max(2000).nullable(),
    /** ISO 8601 en UTC. */
    fechaEnvio: z.iso.datetime().nullable(),
  })
  .refine((d) => (d.estadoHtml === "DISPONIBLE") === (d.htmlLimpio !== null), {
    message: "htmlLimpio existe si y solo si estadoHtml es DISPONIBLE",
  });
export type DatosCorreoEntrante = z.infer<typeof datosCorreoEntranteSchema>;
