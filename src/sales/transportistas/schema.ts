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
  // 023-transportistas-por-pais — obligatorio en alta (FR-001); permite
  // tener el mismo courier comercial registrado por separado en varios
  // países (ej. "UnoExpress" en Panamá y en Colombia).
  paisId: z.string().min(1, "Selecciona un país"),
});

// 022-transportistas-zonas-tarifas — datos de contacto operativo, todos
// opcionales; teléfono/correo solo se validan cuando se completan (FR-005).
const CAMPOS_CONTACTO = {
  personaContacto: z.string().max(150).optional().or(z.literal("")),
  telefono: z.string().max(30).optional().or(z.literal("")).refine(
    (v) => !v || /^[+\d][\d\s()-]{5,29}$/.test(v),
    "Teléfono inválido",
  ),
  correoElectronico: z.string().email("Correo inválido").max(150).optional().or(z.literal("")),
  notasInternas: z.string().max(1000).optional().or(z.literal("")),
};

export const EditarTransportistaSchema = CrearTransportistaSchema.extend({
  id: z.string().min(1),
  // 023-transportistas-por-pais — opcional en edición: se acepta en el
  // payload, pero la Server Action rechaza el cambio si el transportista ya
  // tiene alguna tarifa configurada (research.md Decisión 3).
  paisId: z.string().min(1, "Selecciona un país").optional(),
  ...CAMPOS_CONTACTO,
});

export type CrearTransportistaInput = z.infer<typeof CrearTransportistaSchema>;
export type EditarTransportistaInput = z.infer<typeof EditarTransportistaSchema>;
