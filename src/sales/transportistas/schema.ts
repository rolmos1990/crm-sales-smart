import { z } from "zod";

export const TipoTransportistaEnum = z.enum([
  "COURIER_EXTERNO",
  "MENSAJERO_PROPIO",
  "RETIRO_TIENDA",
  "DIGITAL",
  "INSTALACION_SERVICIO",
]);

export const CrearTransportistaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(80),
  tipo:   TipoTransportistaEnum,
});

export const EditarTransportistaSchema = CrearTransportistaSchema.extend({
  id: z.string().min(1),
});

export type CrearTransportistaInput = z.infer<typeof CrearTransportistaSchema>;
export type EditarTransportistaInput = z.infer<typeof EditarTransportistaSchema>;
