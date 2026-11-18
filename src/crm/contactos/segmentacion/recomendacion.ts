// 041 — Seguimiento y recomendación de UNA fila ya cargada. El seguimiento
// replica en memoria la precedencia de `condicionSeguimiento`
// (condiciones.ts); hay un test que exige que ambas den el mismo estado.
import type { CortesSeguimiento } from "./cortes";
import type { EstadoSeguimiento } from "./condiciones";

export const RECOMENDACIONES = [
  "NO_CONTACTAR",
  "RESPONDER",
  "RETOMAR_CONVERSACION",
  "CONTACTAR_HOY",
  "DAR_SEGUIMIENTO",
  "OFRECER_NOVEDADES",
  "EVALUAR",
  "SIN_URGENCIA",
] as const;
export type Recomendacion = (typeof RECOMENDACIONES)[number];

export type NivelInteresValor = "ALTO" | "MEDIO" | "BAJO" | "SIN_EVALUAR";

export interface DatosSeguimientoFila {
  ultimaInteraccionEn: Date | null;
  creadoEn: Date;
  esperandoRespuesta: boolean;
  tieneActividadVencida: boolean;
  tieneActividadVigente: boolean;
  esInteresado: boolean;
  noContactar: boolean;
}

export function calcularSeguimientoFila(fila: DatosSeguimientoFila, cortes: CortesSeguimiento): EstadoSeguimiento {
  const referencia = fila.ultimaInteraccionEn ?? fila.creadoEn;
  if (fila.esperandoRespuesta || fila.tieneActividadVencida) return "PENDIENTE";
  if (fila.tieneActividadVigente || referencia >= cortes.pendiente) return "AL_DIA";
  if (fila.esInteresado && !fila.noContactar) {
    return referencia >= cortes.recuperar ? "PENDIENTE" : "POR_RECUPERAR";
  }
  if (referencia < cortes.inactivo) return "INACTIVO";
  return "AL_DIA";
}

export interface DatosRecomendacion {
  noContactar: boolean;
  esperandoRespuesta: boolean;
  seguimiento: EstadoSeguimiento;
  esCliente: boolean;
  esInteresado: boolean;
  interes: NivelInteresValor;
}

/**
 * FR-031: la primera que aplique. "No contactar" va antes que "Responder"
 * (research D12): si un contacto que pidió no ser contactado vuelve a
 * escribir, la persona decide al abrir la conversación, donde ve el aviso.
 */
export function calcularRecomendacion(d: DatosRecomendacion): Recomendacion {
  if (d.noContactar) return "NO_CONTACTAR";
  if (d.esperandoRespuesta) return "RESPONDER";
  if (d.seguimiento === "POR_RECUPERAR") return "RETOMAR_CONVERSACION";
  if (d.seguimiento === "PENDIENTE") return d.interes === "ALTO" ? "CONTACTAR_HOY" : "DAR_SEGUIMIENTO";
  if (d.esCliente && d.seguimiento === "INACTIVO" && !d.esInteresado) return "OFRECER_NOVEDADES";
  if (!d.esCliente && !d.esInteresado && d.interes === "SIN_EVALUAR") return "EVALUAR";
  return "SIN_URGENCIA";
}
