import { describe, expect, it } from "vitest";

import {
  accionPorReglas,
  calcularProximaEvaluacion,
  calcularRelacionComercial,
  esAccionDeHechos,
  evaluarPorReglas,
  motivosReglas,
} from "./reglas";
import { PLANTILLAS } from "./criterio/plantillas";
import { CriterioContenidoSchema } from "./criterio/schema";
import type { DatosContactoLote } from "./types";

const AHORA = new Date("2026-11-19T15:00:00Z");
const diasAtras = (n: number) => new Date(AHORA.getTime() - n * 86_400_000);
const diasAdelante = (n: number) => new Date(AHORA.getTime() + n * 86_400_000);
const SEGUIMIENTO = { pendiente: 3, recuperar: 7, inactivo: 60 };
const GENERAL = PLANTILLAS.GENERAL.contenido;

const base: DatosContactoLote = {
  contactoId: "c1",
  creadoEn: diasAtras(200),
  ultimaInteraccionEn: diasAtras(1),
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
  ultimoMensajeEn: null,
  evaluacionPrevia: null,
};

describe("plantillas de criterio", () => {
  it.each(Object.entries(PLANTILLAS))("%s valida contra el esquema", (_clave, p) => {
    expect(CriterioContenidoSchema.safeParse(p.contenido).success).toBe(true);
  });
});

describe("calcularRelacionComercial", () => {
  const umbrales = { comprasRecurrente: 2, diasInactivo: 90 };
  it.each([
    ["sin compras", { compras: 0, ultimaCompraEn: null }, "PROSPECTO"],
    ["1 compra reciente", { compras: 1, ultimaCompraEn: diasAtras(10) }, "CLIENTE"],
    ["2 compras recientes", { compras: 2, ultimaCompraEn: diasAtras(10) }, "CLIENTE_RECURRENTE"],
    ["justo en el umbral sigue activo", { compras: 1, ultimaCompraEn: diasAtras(90) }, "CLIENTE"],
    ["un día después del umbral", { compras: 1, ultimaCompraEn: diasAtras(91) }, "CLIENTE_INACTIVO"],
    ["recurrente inactivo es inactivo", { compras: 5, ultimaCompraEn: diasAtras(200) }, "CLIENTE_INACTIVO"],
  ] as const)("%s", (_n, d, esperado) => {
    expect(calcularRelacionComercial(d, umbrales, AHORA)).toBe(esperado);
  });

  it("respeta los umbrales de cada plantilla", () => {
    const d = { compras: 2, ultimaCompraEn: diasAtras(70) };
    expect(calcularRelacionComercial(d, PLANTILLAS.GENERAL.contenido.umbrales, AHORA)).toBe("CLIENTE_RECURRENTE");
    expect(calcularRelacionComercial(d, PLANTILLAS.RETAIL.contenido.umbrales, AHORA)).toBe("CLIENTE_INACTIVO");
    expect(calcularRelacionComercial(d, PLANTILLAS.B2B.contenido.umbrales, AHORA)).toBe("CLIENTE_RECURRENTE");
  });
});

describe("motivos", () => {
  it("dice cuántas compras confirmadas tiene (Historia 1, escenario 1)", () => {
    const d = { ...base, compras: 2, ultimaCompraEn: diasAtras(3), esCliente: true };
    expect(motivosReglas(d, "CLIENTE_RECURRENTE", AHORA)).toContain("2 compras confirmadas");
  });
});

describe("accionPorReglas y precedencia de hechos", () => {
  it("No contactar gana incluso con mensaje sin responder", () => {
    expect(accionPorReglas({ ...base, noContactar: true, esperandoRespuesta: true, seguimiento: "PENDIENTE" })).toBe("NO_CONTACTAR");
  });
  it("mensaje sin responder → RESPONDER", () => {
    expect(accionPorReglas({ ...base, esperandoRespuesta: true, seguimiento: "PENDIENTE" })).toBe("RESPONDER");
  });
  it("cliente inactivo sin interés → ofrecer novedades", () => {
    expect(accionPorReglas({ ...base, esCliente: true, seguimiento: "INACTIVO", nivelInteres: "BAJO" })).toBe("OFRECER_NOVEDADES");
  });
  it("solo RESPONDER y NO_CONTACTAR son acciones de hechos", () => {
    expect(esAccionDeHechos("RESPONDER")).toBe(true);
    expect(esAccionDeHechos("NO_CONTACTAR")).toBe(true);
    expect(esAccionDeHechos("CONTACTAR_HOY")).toBe(false);
  });
});

describe("calcularProximaEvaluacion", () => {
  it("usa la próxima actividad si es lo más cercano", () => {
    const d = { ...base, proximaActividadEn: diasAdelante(2) };
    expect(calcularProximaEvaluacion(d, "PROSPECTO", GENERAL.umbrales, SEGUIMIENTO, AHORA)).toEqual(diasAdelante(2));
  });
  it("un interesado se revisa cuando pasaría a Por recuperar", () => {
    const d = { ...base, esInteresado: true, ultimaInteraccionEn: diasAtras(2) };
    expect(calcularProximaEvaluacion(d, "PROSPECTO", GENERAL.umbrales, SEGUIMIENTO, AHORA)).toEqual(diasAdelante(5));
  });
  it("un interesado marcado No contactar no se programa por recuperar", () => {
    const d = { ...base, esInteresado: true, noContactar: true, ultimaInteraccionEn: diasAtras(2) };
    expect(calcularProximaEvaluacion(d, "PROSPECTO", GENERAL.umbrales, SEGUIMIENTO, AHORA)).toBeNull();
  });
  it("un cliente se revisa cuando pasaría a inactivo", () => {
    const d = { ...base, compras: 1, ultimaCompraEn: diasAtras(10), esCliente: true };
    expect(calcularProximaEvaluacion(d, "CLIENTE", GENERAL.umbrales, SEGUIMIENTO, AHORA)).toEqual(diasAdelante(81));
  });
  it("sin nada por venir → null", () => {
    expect(calcularProximaEvaluacion(base, "PROSPECTO", GENERAL.umbrales, SEGUIMIENTO, AHORA)).toBeNull();
  });
});

describe("evaluarPorReglas", () => {
  it("un recurrente con cotización activa puntúa más que un prospecto frío", () => {
    const frio = evaluarPorReglas({ ...base, ultimaInteraccionEn: diasAtras(120) }, GENERAL, SEGUIMIENTO, AHORA);
    const caliente = evaluarPorReglas(
      { ...base, compras: 3, ultimaCompraEn: diasAtras(5), esCliente: true, cotizacionesActivas: 1 },
      GENERAL,
      SEGUIMIENTO,
      AHORA,
    );
    expect(caliente.relacionComercial).toBe("CLIENTE_RECURRENTE");
    expect(caliente.puntajeBase).toBeGreaterThan(frio.puntajeBase);
    expect(caliente.puntajeBase).toBeLessThanOrEqual(60);
    expect(frio.puntajeBase).toBeGreaterThanOrEqual(0);
  });
});
