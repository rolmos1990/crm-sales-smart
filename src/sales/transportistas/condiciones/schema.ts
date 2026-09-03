import { z } from "zod";

// 022-transportistas-zonas-tarifas — reglas generales de operación/
// restricciones/cobro (FR-029/030/031). No incluye tiempo de entrega ni
// peso por zona/servicio puntual — eso vive en TarifaTransportistaZona
// (FR-033).
export const DiaSemanaEnum = z.enum(["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"]);

// 024 — sin `.default()` a propósito (feedback del proyecto: `.default()` en
// un schema usado con react-hook-form deja el campo opcional en el tipo de
// entrada pero obligatorio en el de salida, y descoordina el resolver de
// `useForm`). Los valores por defecto se fijan en `defaultValues` del form.
export const CondicionesTransportistaSchema = z.object({
  transportistaId: z.string().min(1),
  diasEntrega: z.array(DiaSemanaEnum),
  horaLimiteMismoDia: z.string().max(5).optional().or(z.literal("")),
  tiempoPreparacionDias: z.number().int().min(0),
  permiteEntregaMismoDia: z.boolean(),
  pesoMaximoKg: z.number().min(0).optional().nullable(),
  requiereDireccionCompleta: z.boolean(),
  permiteArticulosFragiles: z.boolean(),
  permitePagoContraEntrega: z.boolean(),
  observaciones: z.string().max(1000).optional().or(z.literal("")),
  metodoPagoTransportista: z.string().max(100).optional().or(z.literal("")),
  frecuenciaFacturacion: z.string().max(100).optional().or(z.literal("")),
  responsableCoordinacion: z.string().max(150).optional().or(z.literal("")),
  instruccionesCoordinacion: z.string().max(1000).optional().or(z.literal("")),
});

export type CondicionesTransportistaInput = z.infer<typeof CondicionesTransportistaSchema>;
