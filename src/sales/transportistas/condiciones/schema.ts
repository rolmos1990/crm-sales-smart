import { z } from "zod";

// 022-transportistas-zonas-tarifas — reglas generales de operación/
// restricciones/cobro (FR-029/030/031). No incluye tiempo de entrega ni
// peso por zona/servicio puntual — eso vive en TarifaTransportistaZona
// (FR-033).
export const DiaSemanaEnum = z.enum(["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"]);

export const CondicionesTransportistaSchema = z.object({
  transportistaId: z.string().min(1),
  diasEntrega: z.array(DiaSemanaEnum).default([]),
  horaLimiteMismoDia: z.string().max(5).optional().or(z.literal("")),
  tiempoPreparacionDias: z.number().int().min(0).default(0),
  permiteEntregaMismoDia: z.boolean().default(true),
  pesoMaximoKg: z.number().min(0).optional().nullable(),
  requiereDireccionCompleta: z.boolean().default(true),
  permiteArticulosFragiles: z.boolean().default(true),
  permitePagoContraEntrega: z.boolean().default(false),
  observaciones: z.string().max(1000).optional().or(z.literal("")),
  metodoPagoTransportista: z.string().max(100).optional().or(z.literal("")),
  frecuenciaFacturacion: z.string().max(100).optional().or(z.literal("")),
  responsableCoordinacion: z.string().max(150).optional().or(z.literal("")),
  instruccionesCoordinacion: z.string().max(1000).optional().or(z.literal("")),
});

export type CondicionesTransportistaInput = z.infer<typeof CondicionesTransportistaSchema>;
