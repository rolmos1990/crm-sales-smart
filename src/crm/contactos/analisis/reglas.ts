// 042 — Etapa de reglas del análisis (research D7). Pura: sin Prisma en
// runtime, para probar cada borde sin base de datos. Lo que se puede saber
// con certeza (compras, documentos abiertos, mensajes sin responder) sale de
// acá y nunca de la IA (FR-002, FR-020).
import type { AccionComercial, RelacionComercial } from "@/generated/prisma/enums";
import { calcularRecomendacion, type Recomendacion } from "@/crm/contactos/segmentacion/recomendacion";
import type { UmbralesSeguimiento } from "@/crm/contactos/segmentacion/cortes";
import type { CriterioContenido, UmbralesCriterio } from "./criterio/schema";
import { calcularPuntajeBase, type FactoresPuntaje } from "./puntaje";
import type { DatosContactoLote, ResultadoReglas } from "./types";

const DIA_MS = 24 * 60 * 60 * 1000;

function diasDesde(fecha: Date, ahora: Date): number {
  return Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / DIA_MS));
}

function sumarDiasMs(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * DIA_MS);
}

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/** CLIENTE_INACTIVO tiene precedencia sobre CLIENTE_RECURRENTE: un recurrente que dejó de comprar es para reactivar. */
export function calcularRelacionComercial(
  d: { compras: number; ultimaCompraEn: Date | null },
  umbrales: UmbralesCriterio,
  ahora: Date,
): RelacionComercial {
  if (d.compras <= 0) return "PROSPECTO";
  if (d.ultimaCompraEn && diasDesde(d.ultimaCompraEn, ahora) > umbrales.diasInactivo) return "CLIENTE_INACTIVO";
  if (d.compras >= umbrales.comprasRecurrente) return "CLIENTE_RECURRENTE";
  return "CLIENTE";
}

const ACCION_POR_RECOMENDACION: Record<Recomendacion, AccionComercial> = {
  NO_CONTACTAR: "NO_CONTACTAR",
  RESPONDER: "RESPONDER",
  RETOMAR_CONVERSACION: "REACTIVAR",
  CONTACTAR_HOY: "CONTACTAR_HOY",
  DAR_SEGUIMIENTO: "DAR_SEGUIMIENTO",
  OFRECER_NOVEDADES: "OFRECER_NOVEDADES",
  EVALUAR: "SIN_ACCION",
  SIN_URGENCIA: "SIN_ACCION",
};

/** Reutiliza la recomendación de la 041 para que la lista y el análisis no se contradigan. */
export function accionPorReglas(d: DatosContactoLote): AccionComercial {
  return ACCION_POR_RECOMENDACION[
    calcularRecomendacion({
      noContactar: d.noContactar,
      esperandoRespuesta: d.esperandoRespuesta,
      seguimiento: d.seguimiento,
      esCliente: d.esCliente,
      esInteresado: d.esInteresado,
      interes: d.nivelInteres,
    })
  ];
}

/** Las acciones que deciden los hechos y que ninguna sugerencia de la IA reemplaza (FR-021). */
export function esAccionDeHechos(accion: AccionComercial): boolean {
  return accion === "RESPONDER" || accion === "NO_CONTACTAR";
}

export function senalesObjetivas(d: DatosContactoLote): string[] {
  const senales: string[] = [];
  if (d.esperandoRespuesta) senales.push("Tiene un mensaje sin responder");
  if (d.cotizacionesActivas > 0) senales.push(`Tiene ${plural(d.cotizacionesActivas, "cotización activa", "cotizaciones activas")}`);
  if (d.oportunidadesAbiertas > 0) senales.push(`Tiene ${plural(d.oportunidadesAbiertas, "oportunidad abierta", "oportunidades abiertas")}`);
  if (d.tieneActividadVencida) senales.push("Tiene una actividad vencida");
  return senales;
}

export function motivosReglas(d: DatosContactoLote, relacion: RelacionComercial, ahora: Date): string[] {
  const motivos: string[] = [];
  if (d.compras === 0) {
    motivos.push("Sin compras confirmadas");
  } else {
    motivos.push(plural(d.compras, "compra confirmada", "compras confirmadas"));
    if (d.ultimaCompraEn) {
      const dias = diasDesde(d.ultimaCompraEn, ahora);
      motivos.push(dias === 0 ? "Última compra hoy" : `Última compra hace ${plural(dias, "día", "días")}`);
    }
  }
  if (relacion === "CLIENTE_INACTIVO") motivos.push("Superó el plazo de inactividad del criterio");
  if (d.ultimaInteraccionEn === null) motivos.push("Sin interacciones registradas");
  return motivos;
}

export function factoresPuntaje(
  d: DatosContactoLote,
  relacion: RelacionComercial,
  criterio: CriterioContenido,
  ahora: Date,
): FactoresPuntaje {
  const referencia = d.ultimaInteraccionEn ?? d.creadoEn;
  const compras = Math.min(d.compras / criterio.umbrales.comprasRecurrente, 1);
  return {
    compras: relacion === "CLIENTE_INACTIVO" ? compras * 0.5 : compras,
    recencia: Math.max(0, 1 - diasDesde(referencia, ahora) / criterio.umbrales.diasInactivo),
    documentosAbiertos: Math.min((d.cotizacionesActivas + d.oportunidadesAbiertas) / 2, 1),
    actividadAgendada: d.tieneActividadVigente ? 1 : d.tieneActividadVencida ? 0.5 : 0,
    esperaRespuesta: d.esperandoRespuesta ? 1 : 0,
  };
}

/**
 * Primera fecha futura en la que el estado del contacto cambia aunque no pase
 * nada: una actividad agendada, el momento en que un interesado pasa a "Por
 * recuperar" (041) o en que un cliente pasa a inactivo. `null` si ninguna.
 */
export function calcularProximaEvaluacion(
  d: DatosContactoLote,
  relacion: RelacionComercial,
  umbrales: UmbralesCriterio,
  seguimiento: UmbralesSeguimiento,
  ahora: Date,
): Date | null {
  const candidatas: Date[] = [];
  if (d.proximaActividadEn) candidatas.push(d.proximaActividadEn);
  if (d.esInteresado && !d.noContactar) {
    candidatas.push(sumarDiasMs(d.ultimaInteraccionEn ?? d.creadoEn, seguimiento.recuperar));
  }
  if (d.ultimaCompraEn && relacion !== "CLIENTE_INACTIVO" && relacion !== "PROSPECTO") {
    candidatas.push(sumarDiasMs(d.ultimaCompraEn, umbrales.diasInactivo + 1));
  }
  const futuras = candidatas.filter((f) => f.getTime() > ahora.getTime());
  if (futuras.length === 0) return null;
  return new Date(Math.min(...futuras.map((f) => f.getTime())));
}

export function evaluarPorReglas(
  d: DatosContactoLote,
  criterio: CriterioContenido,
  seguimiento: UmbralesSeguimiento,
  ahora: Date,
): ResultadoReglas {
  const relacionComercial = calcularRelacionComercial(d, criterio.umbrales, ahora);
  return {
    relacionComercial,
    puntajeBase: calcularPuntajeBase(factoresPuntaje(d, relacionComercial, criterio, ahora), criterio.pesos),
    senales: senalesObjetivas(d),
    motivos: motivosReglas(d, relacionComercial, ahora),
    accion: accionPorReglas(d),
    proximaEvaluacionEn: calcularProximaEvaluacion(d, relacionComercial, criterio.umbrales, seguimiento, ahora),
  };
}
