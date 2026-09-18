import { describe, it, expect } from "vitest";
import { parsearExtremosDeSearchParams, parsearRangoDeSearchParams } from "./searchparams";
import { fechaYMDEnZona, parsearFechaImportada } from "./zona";

const PANAMA = "America/Panama";

describe("parsearRangoDeSearchParams", () => {
  it("usa ?desde/?hasta sin prefijo", () => {
    const r = parsearRangoDeSearchParams({ desde: "2026-09-17", hasta: "2026-09-17" }, PANAMA)!;
    expect(fechaYMDEnZona(r.desde, PANAMA)).toBe("2026-09-17");
    expect(fechaYMDEnZona(new Date(r.hasta.getTime() - 1), PANAMA)).toBe("2026-09-17");
  });

  it("respeta el prefijo de cada pantalla", () => {
    const sp = { entregaDesde: "2026-09-17", entregaHasta: "2026-09-19", desde: "2026-01-01" };
    const r = parsearRangoDeSearchParams(sp, PANAMA, { prefijo: "entrega" })!;
    expect(fechaYMDEnZona(r.desde, PANAMA)).toBe("2026-09-17");
    expect(fechaYMDEnZona(new Date(r.hasta.getTime() - 1), PANAMA)).toBe("2026-09-19");
  });

  it("sin params devuelve null", () => {
    expect(parsearRangoDeSearchParams({}, PANAMA)).toBeNull();
    expect(parsearRangoDeSearchParams({ otro: "x" }, PANAMA)).toBeNull();
  });

  it("ignora valores vacíos", () => {
    expect(parsearRangoDeSearchParams({ desde: "", hasta: "  " }, PANAMA)).toBeNull();
  });

  it("toma el primer valor si el param viene repetido", () => {
    const r = parsearRangoDeSearchParams({ desde: ["2026-09-17", "2026-01-01"] }, PANAMA)!;
    expect(fechaYMDEnZona(r.desde, PANAMA)).toBe("2026-09-17");
  });
});

describe("parsearExtremosDeSearchParams", () => {
  it("deja undefined el extremo que el usuario no acotó", () => {
    const soloDesde = parsearExtremosDeSearchParams({ desde: "2026-09-17" }, PANAMA);
    expect(soloDesde.desde).toBeInstanceOf(Date);
    expect(soloDesde.hasta).toBeUndefined();

    const soloHasta = parsearExtremosDeSearchParams({ hasta: "2026-09-17" }, PANAMA);
    expect(soloHasta.desde).toBeUndefined();
    expect(soloHasta.hasta).toBeInstanceOf(Date);
  });

  it("sin params devuelve un objeto vacío, no fechas centinela", () => {
    expect(parsearExtremosDeSearchParams({}, PANAMA)).toEqual({});
  });

  it("el día se interpreta en la zona de negocio, no en UTC", () => {
    const { desde } = parsearExtremosDeSearchParams({ desde: "2026-09-17" }, PANAMA);
    // Medianoche en Panamá (UTC-5) son las 05:00Z, no las 00:00Z.
    expect(desde!.toISOString()).toBe("2026-09-17T05:00:00.000Z");
  });
});

describe("parsearFechaImportada — CSV/XLSX", () => {
  it("un 'YYYY-MM-DD' pelado es una fecha de calendario, no medianoche UTC", () => {
    const d = parsearFechaImportada("2026-09-17", PANAMA)!;
    expect(fechaYMDEnZona(d, PANAMA)).toBe("2026-09-17");
    expect(d.toISOString()).toBe("2026-09-17T05:00:00.000Z");
    // Lo que hacía antes el importador, y por qué guardaba el día anterior:
    expect(fechaYMDEnZona(new Date("2026-09-17"), PANAMA)).toBe("2026-09-16");
  });

  it("un ISO con hora ya es un instante y se respeta tal cual", () => {
    const iso = "2026-09-17T14:30:00.000Z";
    expect(parsearFechaImportada(iso, PANAMA)!.toISOString()).toBe(iso);
  });

  it("acepta un Date directo", () => {
    const d = new Date("2026-09-17T14:30:00.000Z");
    expect(parsearFechaImportada(d, PANAMA)).toBe(d);
  });

  it.each([null, undefined, "", "   ", "no-es-fecha"])(
    "%s devuelve null en vez de Invalid Date",
    (v) => {
      expect(parsearFechaImportada(v, PANAMA)).toBeNull();
    },
  );
});
