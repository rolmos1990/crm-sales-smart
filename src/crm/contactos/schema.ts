import { z } from "zod";

export const CrearContactoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  apellido: z.string().min(1, "El apellido es requerido").max(100),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefonoPrincipal: z.string().max(30).optional().or(z.literal("")),
  telefonoSecundario: z.string().max(30).optional().or(z.literal("")),
  cargo: z.string().max(100).optional().or(z.literal("")),
  notas: z.string().max(2000).optional().or(z.literal("")),
  estado: z.enum(["ACTIVO", "INACTIVO", "LEAD"]).optional(),
  empresaId: z.string().optional().or(z.literal("")),
  tagIds: z.array(z.string()).optional(),
});

export const ActualizarContactoSchema = CrearContactoSchema.partial();

export type CrearContactoInput = z.infer<typeof CrearContactoSchema>;
export type ActualizarContactoInput = z.infer<typeof ActualizarContactoSchema>;

// ── 041 — Vista comercial de Contactos ─────────────────────────────────────
// Los filtros viajan en el cuerpo de la Server Action, no en la URL: mismo
// criterio que Pedidos y Preparación (useVistaFiltrada).

export const TAMANOS_PAGINA_CONTACTOS = [20, 50, 100] as const;

export const FiltrosVistaContactosSchema = z.object({
  pagina: z.number().int().min(1).default(1),
  tamanoPagina: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(50),
  orden: z.enum(["PRIORIDAD", "NOMBRE", "ULTIMA_ACTIVIDAD", "INTERES", "PUNTAJE"]).default("PRIORIDAD"),
  direccion: z.enum(["asc", "desc"]).optional(),
  segmento: z.enum(["TODOS", "CLIENTES", "INTERESADOS", "POR_RECUPERAR", "LEADS"]).default("TODOS"),
  busqueda: z.string().trim().max(100).default(""),
  tipo: z.enum(["CLIENTE", "INTERESADO", "LEAD"]).optional(),
  interes: z.enum(["ALTO", "MEDIO", "BAJO", "SIN_EVALUAR"]).optional(),
  canal: z.enum(["WHATSAPP", "INSTAGRAM", "FACEBOOK_MESSENGER", "EMAIL"]).optional(),
  ultimaActividad: z.enum(["HOY", "ULTIMOS_7", "ULTIMOS_30", "MAS_DE_30", "SIN_ACTIVIDAD"]).optional(),
  seguimiento: z.enum(["AL_DIA", "PENDIENTE", "POR_RECUPERAR", "INACTIVO"]).optional(),
  preferencia: z.enum(["CONTACTABLE", "NO_CONTACTAR"]).optional(),
});

export type FiltrosVistaContactos = z.infer<typeof FiltrosVistaContactosSchema>;

export const FILTROS_VISTA_CONTACTOS_DEFECTO: FiltrosVistaContactos = FiltrosVistaContactosSchema.parse({});

const idContacto = z.string().min(1).max(64);

export const ActualizarInteresContactoSchema = z.object({
  contactoId: idContacto,
  accion: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("FIJAR"), nivel: z.enum(["ALTO", "MEDIO", "BAJO", "SIN_EVALUAR"]) }),
    z.object({ tipo: z.literal("LIBERAR") }),
  ]),
});
export type ActualizarInteresContactoInput = z.infer<typeof ActualizarInteresContactoSchema>;

export const ActualizarPreferenciaContactoSchema = z.object({
  contactoId: idContacto,
  noContactar: z.boolean(),
});
export type ActualizarPreferenciaContactoInput = z.infer<typeof ActualizarPreferenciaContactoSchema>;

export const ResumenContactoSchema = z.object({ contactoId: idContacto });
