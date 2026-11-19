import { describe, expect, it } from "vitest";

import { accionVisible, calcularSugerencias, decidirIA, nivelDeIntencion } from "./decisiones";
import type { DatosContactoLote, EvaluacionPrevia, ResultadoIAContacto } from "../types";

const AHORA = new Date("2026-11-19T15:00:00Z");
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000);

const datos = (extra: Partial<DatosContactoLote> = {}): DatosContactoLote => ({
  contactoId: "c1",
  creadoEn: hace(400),
  ultimaInteraccionEn: hace(2),
  esperandoRespuesta: false,
  noContactar: false,
  nivelInteres: "SIN_EVALUAR",
  nivelInteresFijado: false,
  compras: 0,
  valorCompras: 0,
  ultimaCompraEn: null,
  cotizacionesActivas: 0,
  oportunidadesAbiertas: 0,
  tieneActividadVencida: false,
  tieneActividadVigente: false,
  proximaActividadEn: null,
  esCliente: false,
  esInteresado: false,
  seguimiento: "AL_DIA",
  ultimoMensajeEn: hace(2),
  evaluacionPrevia: null,
  ...extra,
});

const previa = (extra: Partial<EvaluacionPrevia> = {}): EvaluacionPrevia => ({
  puntaje: 40,
  ajusteIA: null,
  accionIA: null,
  versionEvaluada: BigInt(1),
  intencion: null,
  senales: [],
  iaHasta: null,
  evaluadoIAEn: null,
  noContactarResueltoEn: null,
  interesSugerido: null,
  interesSugeridoEstado: null,
  ...extra,
});

const ia = (extra: Partial<ResultadoIAContacto> = {}): ResultadoIAContacto => ({
  intencion: "ALTA",
  intencionComercial: "LISTO_PARA_COMPRAR",
  urgencia: "ALTA",
  recuperacion: "NO_APLICA",
  ajustePuntaje: 20,
  senales: [],
  objeciones: [],
  motivos: [],
  accionSugerida: "ENVIAR_COTIZACION",
  sugerirNoContactar: false,
  motivoNoContactar: null,
  productosConsultados: [],
  presupuestoConocido: null,
  ocasionActual: null,
  fechaRequerida: null,
  ...extra,
});

const base = { reclamado: { forzarIA: false }, iaDisponible: true, mesesAntiguedadInicial: 12, ahora: AHORA };

describe("decidirIA (embudo, research D5)", () => {
  it("sin IA disponible → reglas", () => {
    expect(decidirIA({ ...base, datos: datos(), iaDisponible: false })).toEqual({ va: false, motivo: "IA_NO_DISPONIBLE" });
  });
  it("sin conversación nunca va a la IA, aunque lo pidan", () => {
    expect(decidirIA({ ...base, datos: datos({ ultimoMensajeEn: null }), reclamado: { forzarIA: true } })).toMatchObject({ va: false, motivo: "SIN_CONVERSACION" });
  });
  it("sin mensajes nuevos desde el último análisis → reglas", () => {
    expect(decidirIA({ ...base, datos: datos({ evaluacionPrevia: previa({ iaHasta: hace(2), evaluadoIAEn: hace(2) }) }) })).toMatchObject({ va: false, motivo: "SIN_MENSAJES_NUEVOS" });
  });
  it("con mensajes nuevos → IA", () => {
    expect(decidirIA({ ...base, datos: datos({ evaluacionPrevia: previa({ iaHasta: hace(5), evaluadoIAEn: hace(5) }) }) })).toEqual({ va: true });
  });
  it("un pedido explícito va a la IA aunque no haya mensajes nuevos", () => {
    expect(decidirIA({ ...base, datos: datos({ evaluacionPrevia: previa({ iaHasta: hace(2), evaluadoIAEn: hace(2) }) }), reclamado: { forzarIA: true } })).toEqual({ va: true });
  });
  it("clasificación inicial: fuera de los 12 meses → reglas (Clarifications Q2)", () => {
    expect(decidirIA({ ...base, datos: datos({ ultimaInteraccionEn: hace(400), ultimoMensajeEn: hace(400) }) })).toMatchObject({ va: false, motivo: "FUERA_DE_ANTIGUEDAD" });
  });
  it("si ya tuvo IA, la antigüedad no aplica", () => {
    expect(decidirIA({ ...base, datos: datos({ ultimaInteraccionEn: hace(400), ultimoMensajeEn: hace(390), evaluacionPrevia: previa({ iaHasta: hace(395), evaluadoIAEn: hace(395) }) }) })).toEqual({ va: true });
  });
});

describe("accionVisible (FR-021)", () => {
  it("Responder y No contactar ganan a la IA", () => {
    expect(accionVisible("RESPONDER", "OFRECER_NOVEDADES")).toBe("RESPONDER");
    expect(accionVisible("NO_CONTACTAR", "CONTACTAR_HOY")).toBe("NO_CONTACTAR");
  });
  it("si no, manda la IA; sin IA, las reglas", () => {
    expect(accionVisible("DAR_SEGUIMIENTO", "ENVIAR_COTIZACION")).toBe("ENVIAR_COTIZACION");
    expect(accionVisible("DAR_SEGUIMIENTO", null)).toBe("DAR_SEGUIMIENTO");
  });
});

describe("calcularSugerencias (research D14)", () => {
  it("SOLO_SUGERIR guarda la sugerencia y no aplica nada", () => {
    const r = calcularSugerencias({ ia: ia(), datos: datos(), modo: "SOLO_SUGERIR", datosHasta: hace(2) });
    expect(r).toMatchObject({ interesSugerido: "ALTO", interesSugeridoEstado: "PENDIENTE", aplicarInteres: null });
  });
  it("APLICAR_AUTOMATICO aplica después del commit y no deja sugerencia", () => {
    const r = calcularSugerencias({ ia: ia({ intencion: "MEDIA" }), datos: datos(), modo: "APLICAR_AUTOMATICO", datosHasta: hace(2) });
    expect(r.aplicarInteres).toBe("MEDIO");
    expect(r.interesSugerido).toBeUndefined();
  });
  it("con interés fijado a mano no se sugiere ni se aplica", () => {
    for (const modo of ["SOLO_SUGERIR", "APLICAR_AUTOMATICO"] as const) {
      const r = calcularSugerencias({ ia: ia(), datos: datos({ nivelInteresFijado: true, nivelInteres: "BAJO" }), modo, datosHasta: hace(2) });
      expect(r.aplicarInteres).toBeNull();
      expect(r.interesSugerido).toBeUndefined();
    }
  });
  it("si el interés ya es ese, no hay sugerencia; una pendiente anterior queda reemplazada", () => {
    const r = calcularSugerencias({ ia: ia(), datos: datos({ nivelInteres: "ALTO", evaluacionPrevia: previa({ interesSugeridoEstado: "PENDIENTE", interesSugerido: "MEDIO" }) }), modo: "SOLO_SUGERIR", datosHasta: hace(2) });
    expect(r.interesSugerido).toBeUndefined();
    expect(r.interesSugeridoEstado).toBe("REEMPLAZADA");
  });
  it("DESCONOCIDA no sugiere interés", () => {
    expect(nivelDeIntencion("DESCONOCIDA")).toBeNull();
    const r = calcularSugerencias({ ia: ia({ intencion: "DESCONOCIDA" }), datos: datos(), modo: "SOLO_SUGERIR", datosHasta: hace(2) });
    expect(r.interesSugerido).toBeUndefined();
  });
  it("No contactar siempre es sugerencia, nunca escritura (FR-016a)", () => {
    const r = calcularSugerencias({ ia: ia({ sugerirNoContactar: true, motivoNoContactar: "Pidió no recibir más mensajes" }), datos: datos(), modo: "APLICAR_AUTOMATICO", datosHasta: hace(2) });
    expect(r).toMatchObject({ noContactarSugerido: true, noContactarSugeridoEstado: "PENDIENTE" });
  });
  it("un descarte posterior al último mensaje que vio la IA no se vuelve a sugerir", () => {
    const r = calcularSugerencias({ ia: ia({ sugerirNoContactar: true }), datos: datos({ evaluacionPrevia: previa({ noContactarResueltoEn: hace(1) }) }), modo: "SOLO_SUGERIR", datosHasta: hace(2) });
    expect(r.noContactarSugerido).toBeUndefined();
  });
  it("un rechazo nuevo, posterior al descarte, sí se sugiere", () => {
    const r = calcularSugerencias({ ia: ia({ sugerirNoContactar: true }), datos: datos({ evaluacionPrevia: previa({ noContactarResueltoEn: hace(3) }) }), modo: "SOLO_SUGERIR", datosHasta: hace(1) });
    expect(r.noContactarSugerido).toBe(true);
  });
});
