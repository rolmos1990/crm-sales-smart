import { describe, it, expect } from "vitest";
import {
  aFiltroPrisma,
  rangoAyer,
  rangoEntreFechas,
  rangoEsteMes,
  rangoEstaSemana,
  rangoHoy,
  rangoManana,
  rangoMesHastaAhora,
  rangoUltimosDias,
} from "./rangos";
import { fechaYMDEnZona } from "./zona";

// 23:30 del 17/09 en Lima (UTC-5): calcular "hoy" en la zona del servidor o
// del navegador daría el 18.
const REF_LIMA = new Date("2026-09-18T04:30:00.000Z");
// 00:30 del 18/09 en Madrid (UTC+2): cruza el día en el sentido contrario.
const REF_MADRID = new Date("2026-09-17T22:30:00.000Z");

describe("rangoHoy / rangoAyer / rangoManana", () => {
  it("cerca de medianoche resuelve el día de la zona, no el de UTC", () => {
    const hoy = rangoHoy("America/Lima", REF_LIMA);
    expect(fechaYMDEnZona(hoy.desde, "America/Lima")).toBe("2026-09-17");
    expect(hoy.desde.toISOString()).toBe("2026-09-17T05:00:00.000Z");
    expect(hoy.hasta.toISOString()).toBe("2026-09-18T05:00:00.000Z");
  });

  it("el mismo instante da días distintos según la zona", () => {
    expect(fechaYMDEnZona(rangoHoy("Europe/Madrid", REF_MADRID).desde, "Europe/Madrid")).toBe("2026-09-18");
    expect(fechaYMDEnZona(rangoHoy("America/Panama", REF_MADRID).desde, "America/Panama")).toBe("2026-09-17");
  });

  it("ayer, hoy y mañana son contiguos y no se solapan", () => {
    const [ayer, hoy, manana] = [rangoAyer, rangoHoy, rangoManana].map((f) => f("America/Lima", REF_LIMA));
    expect(ayer.hasta.toISOString()).toBe(hoy.desde.toISOString());
    expect(hoy.hasta.toISOString()).toBe(manana.desde.toISOString());
  });
});

describe("rangoUltimosDias", () => {
  it("n=1 es exactamente hoy", () => {
    const uno = rangoUltimosDias("America/Lima", 1, REF_LIMA);
    const hoy = rangoHoy("America/Lima", REF_LIMA);
    expect(uno.desde.toISOString()).toBe(hoy.desde.toISOString());
    expect(uno.hasta.toISOString()).toBe(hoy.hasta.toISOString());
  });

  it("n=7 incluye hoy y los 6 anteriores", () => {
    const r = rangoUltimosDias("America/Lima", 7, REF_LIMA);
    expect(fechaYMDEnZona(r.desde, "America/Lima")).toBe("2026-09-11");
    expect(fechaYMDEnZona(new Date(r.hasta.getTime() - 1), "America/Lima")).toBe("2026-09-17");
  });
});

describe("rangoEstaSemana — semana calendario de lunes a domingo", () => {
  it("el 17/09/2026 es jueves: la semana arranca el lunes 14", () => {
    const r = rangoEstaSemana("America/Lima", REF_LIMA);
    expect(fechaYMDEnZona(r.desde, "America/Lima")).toBe("2026-09-14");
    expect(fechaYMDEnZona(new Date(r.hasta.getTime() - 1), "America/Lima")).toBe("2026-09-20");
  });

  it("un domingo pertenece a la semana que empezó el lunes anterior", () => {
    // 2026-09-20 es domingo.
    const r = rangoEstaSemana("America/Lima", new Date("2026-09-20T17:00:00.000Z"));
    expect(fechaYMDEnZona(r.desde, "America/Lima")).toBe("2026-09-14");
  });

  it("un lunes arranca en sí mismo", () => {
    const r = rangoEstaSemana("America/Lima", new Date("2026-09-14T17:00:00.000Z"));
    expect(fechaYMDEnZona(r.desde, "America/Lima")).toBe("2026-09-14");
  });
});

describe("rangoEsteMes / rangoMesHastaAhora", () => {
  it("el mes completo va del día 1 al 1 del mes siguiente", () => {
    const r = rangoEsteMes("America/Lima", REF_LIMA);
    expect(fechaYMDEnZona(r.desde, "America/Lima")).toBe("2026-09-01");
    expect(fechaYMDEnZona(r.hasta, "America/Lima")).toBe("2026-10-01");
  });

  it("cruza el fin de año sin romperse", () => {
    const r = rangoEsteMes("America/Lima", new Date("2026-12-15T17:00:00.000Z"));
    expect(fechaYMDEnZona(r.desde, "America/Lima")).toBe("2026-12-01");
    expect(fechaYMDEnZona(r.hasta, "America/Lima")).toBe("2027-01-01");
  });

  it("mes-hasta-ahora comparte el inicio pero corta en el instante actual", () => {
    const completo = rangoEsteMes("America/Lima", REF_LIMA);
    const parcial = rangoMesHastaAhora("America/Lima", REF_LIMA);
    expect(parcial.desde.toISOString()).toBe(completo.desde.toISOString());
    expect(parcial.hasta.toISOString()).toBe(REF_LIMA.toISOString());
  });
});

describe("rangoEntreFechas — el par desde/hasta de los filtros de la UI", () => {
  it("hasta es inclusivo por día: 17→17 cubre el 17 completo", () => {
    for (const zona of ["America/Lima", "America/Panama", "Europe/Madrid", "UTC"]) {
      const r = rangoEntreFechas("2026-09-17", "2026-09-17", zona)!;
      expect(fechaYMDEnZona(r.desde, zona)).toBe("2026-09-17");
      // El límite superior es exclusivo: el último instante incluido sigue siendo el 17.
      expect(fechaYMDEnZona(new Date(r.hasta.getTime() - 1), zona)).toBe("2026-09-17");
      expect(fechaYMDEnZona(r.hasta, zona)).toBe("2026-09-18");
    }
  });

  it("sin ninguno de los dos devuelve null para poder omitir el filtro", () => {
    expect(rangoEntreFechas(undefined, undefined, "America/Lima")).toBeNull();
    expect(rangoEntreFechas(null, null, "America/Lima")).toBeNull();
  });

  it("solo desde deja el rango abierto hacia adelante", () => {
    const r = rangoEntreFechas("2026-09-17", undefined, "America/Lima")!;
    expect(fechaYMDEnZona(r.desde, "America/Lima")).toBe("2026-09-17");
    expect(r.hasta.getTime()).toBeGreaterThan(new Date("3000-01-01").getTime());
  });

  it("solo hasta deja el rango abierto hacia atrás", () => {
    const r = rangoEntreFechas(undefined, "2026-09-17", "America/Lima")!;
    expect(r.desde.getTime()).toBeLessThan(new Date("1900-01-01").getTime());
    expect(fechaYMDEnZona(new Date(r.hasta.getTime() - 1), "America/Lima")).toBe("2026-09-17");
  });
});

describe("invariantes de todos los rangos", () => {
  const constructores = [
    ["hoy", () => rangoHoy("America/Santiago", REF_LIMA)],
    ["ayer", () => rangoAyer("America/Santiago", REF_LIMA)],
    ["manana", () => rangoManana("America/Santiago", REF_LIMA)],
    ["ultimos30", () => rangoUltimosDias("America/Santiago", 30, REF_LIMA)],
    ["semana", () => rangoEstaSemana("America/Santiago", REF_LIMA)],
    ["mes", () => rangoEsteMes("America/Santiago", REF_LIMA)],
    ["mesHastaAhora", () => rangoMesHastaAhora("America/Santiago", REF_LIMA)],
  ] as const;

  it.each(constructores)("%s cumple desde < hasta", (_nombre, construir) => {
    const r = construir();
    expect(r.desde.getTime()).toBeLessThan(r.hasta.getTime());
  });

  it("aFiltroPrisma siempre emite un rango semiabierto, nunca lte", () => {
    const filtro = aFiltroPrisma(rangoHoy("America/Lima", REF_LIMA))!;
    expect(Object.keys(filtro).sort()).toEqual(["gte", "lt"]);
  });

  it("aFiltroPrisma devuelve undefined sin rango, para poder omitir la condición", () => {
    expect(aFiltroPrisma(null)).toBeUndefined();
    expect(aFiltroPrisma(undefined)).toBeUndefined();
  });
});
