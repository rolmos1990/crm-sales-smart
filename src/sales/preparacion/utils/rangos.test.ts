import { describe, it, expect } from "vitest";
import { rangoDiaEnZona } from "@/sales/pedidos/utils/fechas-zona";
import {
  estaAtrasado,
  filtroAtrasados,
  filtroFechaEntrega,
  inicioDeHoyEnZona,
  rangoSemanaEnZona,
  resolverRango,
} from "./rangos";

const ZONA = "America/Lima";
// 23:30 en Lima del 17/09 (Lima = UTC-5), a propósito cerca de medianoche:
// es el punto donde un cálculo hecho en la zona del navegador o del servidor
// daría un día distinto al del listado de pedidos.
const REFERENCIA = new Date("2026-09-18T04:30:00.000Z");

describe("resolverRango (026) — coherencia con el listado de pedidos", () => {
  it("HOY coincide exactamente con rangoDiaEnZona(0), la misma fuente que usa el listado", () => {
    const rango = resolverRango("HOY", ZONA, undefined, REFERENCIA);
    const esperado = rangoDiaEnZona(ZONA, 0, REFERENCIA);

    expect(rango).not.toBeNull();
    expect(rango!.desde.toISOString()).toBe(esperado.desde.toISOString());
    expect(rango!.hasta.toISOString()).toBe(esperado.hasta.toISOString());
  });

  it("MANANA coincide con rangoDiaEnZona(1)", () => {
    const rango = resolverRango("MANANA", ZONA, undefined, REFERENCIA);
    const esperado = rangoDiaEnZona(ZONA, 1, REFERENCIA);

    expect(rango!.desde.toISOString()).toBe(esperado.desde.toISOString());
    expect(rango!.hasta.toISOString()).toBe(esperado.hasta.toISOString());
  });

  it("HOY y MANANA no se solapan y son contiguos", () => {
    const hoy = resolverRango("HOY", ZONA, undefined, REFERENCIA)!;
    const manana = resolverRango("MANANA", ZONA, undefined, REFERENCIA)!;
    expect(hoy.hasta.toISOString()).toBe(manana.desde.toISOString());
  });
});

describe("rangoSemanaEnZona", () => {
  it("arranca hoy (no mañana) y cubre 7 días", () => {
    const semana = rangoSemanaEnZona(ZONA, REFERENCIA);
    const hoy = rangoDiaEnZona(ZONA, 0, REFERENCIA);

    expect(semana.desde.toISOString()).toBe(hoy.desde.toISOString());
    const dias = (semana.hasta.getTime() - semana.desde.getTime()) / 86400000;
    expect(dias).toBe(7);
  });

  it("contiene el rango de hoy y el de mañana", () => {
    const semana = rangoSemanaEnZona(ZONA, REFERENCIA);
    const manana = rangoDiaEnZona(ZONA, 1, REFERENCIA);

    expect(manana.desde >= semana.desde).toBe(true);
    expect(manana.hasta <= semana.hasta).toBe(true);
  });

  it("SEMANA delega en rangoSemanaEnZona", () => {
    const viaResolver = resolverRango("SEMANA", ZONA, undefined, REFERENCIA)!;
    const directo = rangoSemanaEnZona(ZONA, REFERENCIA);
    expect(viaResolver.desde.toISOString()).toBe(directo.desde.toISOString());
    expect(viaResolver.hasta.toISOString()).toBe(directo.hasta.toISOString());
  });
});

describe("PERSONALIZADO", () => {
  it("sin fechas no aplica filtro (devuelve null)", () => {
    expect(resolverRango("PERSONALIZADO", ZONA, {}, REFERENCIA)).toBeNull();
    expect(resolverRango("PERSONALIZADO", ZONA, undefined, REFERENCIA)).toBeNull();
  });

  it("con solo 'desde' queda abierto hacia adelante", () => {
    const desde = new Date("2026-09-20T05:00:00.000Z");
    const rango = resolverRango("PERSONALIZADO", ZONA, { desde }, REFERENCIA)!;

    expect(rango.desde.toISOString()).toBe(desde.toISOString());
    expect(rango.hasta.getTime()).toBeGreaterThan(new Date("2100-01-01").getTime());
  });

  it("respeta el rango completo cuando se dan ambas fechas", () => {
    const desde = new Date("2026-09-20T05:00:00.000Z");
    const hasta = new Date("2026-09-25T05:00:00.000Z");
    const rango = resolverRango("PERSONALIZADO", ZONA, { desde, hasta }, REFERENCIA)!;

    expect(rango.desde.toISOString()).toBe(desde.toISOString());
    expect(rango.hasta.toISOString()).toBe(hasta.toISOString());
  });
});

describe("filtroFechaEntrega", () => {
  it("sin rango no filtra", () => {
    expect(filtroFechaEntrega(null)).toBeUndefined();
  });

  it("usa gte/lt para no duplicar el borde entre días contiguos", () => {
    const rango = resolverRango("HOY", ZONA, undefined, REFERENCIA)!;
    const filtro = filtroFechaEntrega(rango);

    expect(filtro).toEqual({ gte: rango.desde, lt: rango.hasta });
  });
});

describe("atrasados — los rangos miran adelante, estos quedarían invisibles", () => {
  it("una entrega de ayer está atrasada", () => {
    const ayer = new Date("2026-09-16T15:00:00.000Z");
    expect(estaAtrasado(ayer, ZONA, REFERENCIA)).toBe(true);
  });

  it("una entrega de hoy NO está atrasada, aunque la hora ya pasó", () => {
    // 10:00 Lima del mismo día que la referencia (23:30 Lima del 17/09).
    const hoyTemprano = new Date("2026-09-17T15:00:00.000Z");
    expect(estaAtrasado(hoyTemprano, ZONA, REFERENCIA)).toBe(false);
  });

  it("una entrega futura no está atrasada", () => {
    expect(estaAtrasado(new Date("2026-09-25T15:00:00.000Z"), ZONA, REFERENCIA)).toBe(false);
  });

  it("sin fecha de entrega no cuenta como atrasado (tiene su propia agrupación)", () => {
    expect(estaAtrasado(null, ZONA, REFERENCIA)).toBe(false);
  });

  it("el filtro corta exactamente en el inicio de hoy, sin solaparse con el rango HOY", () => {
    const filtro = filtroAtrasados(ZONA, REFERENCIA);
    const hoy = resolverRango("HOY", ZONA, undefined, REFERENCIA)!;
    expect(filtro.lt.toISOString()).toBe(hoy.desde.toISOString());
    expect(inicioDeHoyEnZona(ZONA, REFERENCIA).toISOString()).toBe(hoy.desde.toISOString());
  });
});
