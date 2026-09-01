import type { TransportistaModel } from "@/generated/prisma/models/Transportista";
import type { TransportistaCoberturaGeograficaModel } from "@/generated/prisma/models/TransportistaCoberturaGeografica";

export type Transportista = TransportistaModel;

// 019-cobertura-geografica-envios
export type TransportistaCoberturaGeografica = TransportistaCoberturaGeograficaModel;

export type ResultadoAccion<T = void> =
  | { exito: true; data?: T }
  | { exito: false; error: string };

export const TIPO_TRANSPORTISTA_LABELS: Record<string, string> = {
  COURIER_EXTERNO:     "Courier externo",
  MENSAJERO_PROPIO:    "Mensajero propio",
  RETIRO_TIENDA:       "Retiro en tienda",
  DIGITAL:             "Entrega digital",
  INSTALACION_SERVICIO: "Instalación / Servicio",
};
