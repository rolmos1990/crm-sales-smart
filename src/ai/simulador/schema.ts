import { z } from "zod";

// Catálogos de 011 — mismos valores que src/ai/estrategia/tipos.ts.
const TIPOS_RELACION_CLIENTE = [
  "NUEVO_CONTACTO",
  "PROSPECTO_RECURRENTE",
  "CLIENTE_NUEVO",
  "CLIENTE_REGULAR",
  "CLIENTE_INACTIVO",
  "CLIENTE_CON_INCIDENCIA",
] as const;

const INTENCIONES_COMERCIALES = [
  "EXPLORANDO",
  "COMPARANDO",
  "SOLICITANDO_RECOMENDACION",
  "CONSULTANDO_PRECIO",
  "CONSULTANDO_DISPONIBILIDAD",
  "LISTO_PARA_COTIZAR",
  "LISTO_PARA_COMPRAR",
  "ESPERANDO_INFORMACION",
  "REQUIERE_SEGUIMIENTO",
  "REQUIERE_ATENCION_HUMANA",
] as const;

// instanciaId deliberadamente ausente — siempre se resuelve server-side
// desde la sesión (nunca del cliente), ver actions.ts.
export const EscenarioSimulacionSchema = z.object({
  agenteIAConfigId: z.string().min(1),
  cliente: z.object({
    tipoRelacion: z.enum(TIPOS_RELACION_CLIENTE),
    intencion: z.enum(INTENCIONES_COMERCIALES),
  }),
  usarBorrador: z.boolean().default(false),
  mensajes: z.array(z.string().min(1)).min(1).max(10),
});
export type EscenarioSimulacionInput = z.infer<typeof EscenarioSimulacionSchema>;
