// Validación de entrada del canal de correo. Todo lo que llega del navegador
// pasa por acá antes de tocar Prisma o un servidor de correo.
import { z } from "zod";

const SEGURIDADES = ["SSL_TLS", "STARTTLS", "NINGUNA"] as const;

const SchemaConexion = z.object({
  servidor: z.string().trim().min(1, "Indicá el servidor").max(255),
  puerto: z.number().int().min(1).max(65535),
  seguridad: z.enum(SEGURIDADES),
  usuario: z.string().trim().min(1, "Indicá el usuario").max(320),
  password: z.string().max(512).optional(),
});

const SchemaConexionSalida = SchemaConexion.extend({
  nombreRemitente: z.string().trim().max(120).optional(),
});

const camposBuzon = {
  nombre: z.string().trim().min(1, "Poné un nombre para reconocer el buzón").max(60),
  direccion: z.string().trim().toLowerCase().email("Dirección de correo inválida").max(320),
  entrada: SchemaConexion,
  salida: SchemaConexionSalida,
  recepcion: z.object({
    agrupacion: z.enum(["POR_REMITENTE", "POR_HILO"]).default("POR_REMITENTE"),
    crearContactosAutomaticamente: z.boolean().default(true),
  }),
  pipelineId: z.string().nullish(),
  stageId: z.string().nullish(),
};

/**
 * Alta de un buzón: la contraseña es obligatoria en las dos conexiones.
 * Al editar se usa SchemaEditarBuzon, donde dejarla vacía significa
 * "conservar la que ya está guardada".
 */
export const SchemaRegistrarBuzon = z.object(camposBuzon).superRefine((v, ctx) => {
  if (!v.entrada.password) {
    ctx.addIssue({
      code: "custom",
      path: ["entrada", "password"],
      message: "Indicá la contraseña del servidor de entrada",
    });
  }
  if (!v.salida.password) {
    ctx.addIssue({
      code: "custom",
      path: ["salida", "password"],
      message: "Indicá la contraseña del servidor de salida",
    });
  }
});

export const SchemaEditarBuzon = z.object({ ...camposBuzon, id: z.string().min(1) });

/** La prueba de conexión no persiste nada, así que acepta un buzón existente
 *  por id (para reusar sus contraseñas guardadas) o credenciales completas. */
export const SchemaProbarConexion = z.object({
  cuentaCanalId: z.string().min(1).optional(),
  entrada: SchemaConexion,
  salida: SchemaConexionSalida,
});

export const SchemaCambiarEstadoBuzon = z.object({
  id: z.string().min(1),
  activa: z.boolean(),
});

export const SchemaEliminarBuzon = z.object({ id: z.string().min(1) });

export type RegistrarBuzonInput = z.infer<typeof SchemaRegistrarBuzon>;
export type EditarBuzonInput = z.infer<typeof SchemaEditarBuzon>;
export type ProbarConexionInput = z.infer<typeof SchemaProbarConexion>;
