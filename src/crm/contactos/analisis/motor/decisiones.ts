// 042 — Decisiones puras del ejecutor: quién va a la IA (research D5), qué
// acción se muestra (FR-021) y qué se sugiere (research D14). Sin Prisma,
// para probar cada caso sin base de datos.
import type {
  AccionComercial,
  EstadoSugerencia,
  IntencionCompra,
  ModoAplicacionInteres,
  NivelInteres,
} from "@/generated/prisma/enums";
import { esAccionDeHechos } from "../reglas";
import type { ContactoReclamado, DatosContactoLote, ResultadoIAContacto } from "../types";

export function mesesAtras(ahora: Date, meses: number): Date {
  const d = new Date(ahora);
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d;
}

export type MotivoSinIA =
  | "IA_NO_DISPONIBLE"
  | "SIN_CONVERSACION"
  | "SIN_MENSAJES_NUEVOS"
  | "FUERA_DE_ANTIGUEDAD";

/**
 * Embudo reglas → IA. Solo va a la IA quien tiene contenido no estructurado
 * nuevo o un pedido explícito de una persona (FR-012). En la clasificación
 * inicial, además, tiene que haber interactuado dentro del plazo de
 * antigüedad de la cuenta (Clarifications Q2).
 */
export function decidirIA(p: {
  datos: DatosContactoLote;
  reclamado: Pick<ContactoReclamado, "forzarIA">;
  iaDisponible: boolean;
  mesesAntiguedadInicial: number;
  ahora: Date;
}): { va: true } | { va: false; motivo: MotivoSinIA } {
  const { datos } = p;
  if (!p.iaDisponible) return { va: false, motivo: "IA_NO_DISPONIBLE" };
  if (!datos.ultimoMensajeEn) return { va: false, motivo: "SIN_CONVERSACION" };
  if (p.reclamado.forzarIA) return { va: true };

  const iaHasta = datos.evaluacionPrevia?.iaHasta ?? null;
  if (iaHasta && datos.ultimoMensajeEn.getTime() <= iaHasta.getTime()) {
    return { va: false, motivo: "SIN_MENSAJES_NUEVOS" };
  }
  const nuncaConIA = !datos.evaluacionPrevia?.evaluadoIAEn;
  if (nuncaConIA) {
    const referencia = datos.ultimaInteraccionEn ?? datos.ultimoMensajeEn;
    if (referencia.getTime() < mesesAtras(p.ahora, p.mesesAntiguedadInicial).getTime()) {
      return { va: false, motivo: "FUERA_DE_ANTIGUEDAD" };
    }
  }
  return { va: true };
}

/** Acción visible: los hechos (Responder, No contactar) mandan; si no, la IA; si no, las reglas. */
export function accionVisible(accionReglas: AccionComercial, accionIA: AccionComercial | null): AccionComercial {
  if (esAccionDeHechos(accionReglas)) return accionReglas;
  return accionIA ?? accionReglas;
}

export function nivelDeIntencion(intencion: IntencionCompra): NivelInteres | null {
  switch (intencion) {
    case "ALTA":
      return "ALTO";
    case "MEDIA":
      return "MEDIO";
    case "BAJA":
      return "BAJO";
    case "DESCONOCIDA":
      return null;
  }
}

export interface SugerenciasCalculadas {
  /** Campos a escribir en ContactoEvaluacion; `undefined` = no tocar. */
  interesSugerido?: NivelInteres | null;
  interesSugeridoEstado?: EstadoSugerencia | null;
  noContactarSugerido?: boolean;
  noContactarMotivo?: string | null;
  noContactarSugeridoEstado?: EstadoSugerencia | null;
  /** Nivel a aplicar después del commit (solo modo APLICAR_AUTOMATICO). */
  aplicarInteres: NivelInteres | null;
}

/**
 * Sugerencias de una evaluación con IA (research D14, FR-016, FR-016a).
 * - La IA NUNCA escribe "No contactar": solo lo sugiere.
 * - El interés: SOLO_SUGERIR guarda una sugerencia; APLICAR_AUTOMATICO lo
 *   aplica después del commit por `actualizarInteres` (que respeta el fijado).
 * - Nada se sugiere si el interés está fijado a mano o ya tiene ese valor.
 */
export function calcularSugerencias(p: {
  ia: ResultadoIAContacto;
  datos: DatosContactoLote;
  modo: ModoAplicacionInteres;
  /** Último mensaje que vio la IA en esta evaluación. */
  datosHasta: Date | null;
}): SugerenciasCalculadas {
  const { ia, datos } = p;
  const previa = datos.evaluacionPrevia;
  const r: SugerenciasCalculadas = { aplicarInteres: null };

  const nivel = nivelDeIntencion(ia.intencion);
  const aplicaInteres = nivel !== null && !datos.nivelInteresFijado && nivel !== datos.nivelInteres;
  const habiaPendiente = previa?.interesSugeridoEstado === "PENDIENTE";

  if (p.modo === "APLICAR_AUTOMATICO") {
    if (aplicaInteres) r.aplicarInteres = nivel;
    if (habiaPendiente) r.interesSugeridoEstado = "REEMPLAZADA";
  } else if (aplicaInteres) {
    r.interesSugerido = nivel;
    r.interesSugeridoEstado = "PENDIENTE";
  } else if (habiaPendiente) {
    r.interesSugeridoEstado = "REEMPLAZADA";
  }

  if (ia.sugerirNoContactar && !datos.noContactar) {
    const descartadoDespues =
      previa?.noContactarResueltoEn && p.datosHasta && previa.noContactarResueltoEn.getTime() >= p.datosHasta.getTime();
    if (!descartadoDespues) {
      r.noContactarSugerido = true;
      r.noContactarMotivo = ia.motivoNoContactar;
      r.noContactarSugeridoEstado = "PENDIENTE";
    }
  }
  return r;
}
