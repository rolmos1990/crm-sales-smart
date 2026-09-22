import { describe, it, expect } from "vitest";
import {
  aDiaDeCalendario,
  cerrarRango,
  deDiaDeCalendario,
  diasDelRango,
  etiquetaRangoFechas,
  ymdAString,
} from "./rango-ymd";
import { PREFERENCIAS_FECHA_DEFAULT, type PreferenciasFecha } from "./formato";

const prefs = (extra: Partial<PreferenciasFecha> = {}): PreferenciasFecha => ({
  ...PREFERENCIAS_FECHA_DEFAULT,
  zonaHoraria: "America/Lima",
  ...extra,
});

describe("ymdAString", () => {
  it("rellena mes y día con cero", () => {
    expect(ymdAString({ anio: 2026, mes: 9, dia: 7 })).toBe("2026-09-07");
    expect(ymdAString({ anio: 2026, mes: 12, dia: 31 })).toBe("2026-12-31");
  });
});

describe("el ida y vuelta con el calendario no corre el día", () => {
  it("aDiaDeCalendario → deDiaDeCalendario es la identidad", () => {
    for (const ymd of ["2026-01-01", "2026-09-17", "2026-12-31", "2028-02-29"]) {
      expect(deDiaDeCalendario(aDiaDeCalendario(ymd))).toBe(ymd);
    }
  });

  it("deDiaDeCalendario lee componentes locales, no UTC", () => {
    // Medianoche local del 17: `toISOString().slice(0,10)` daría el 16 en
    // cualquier zona con offset negativo. Acá no puede pasar.
    const d = new Date(2026, 8, 17);
    expect(deDiaDeCalendario(d)).toBe("2026-09-17");
  });
});

describe("diasDelRango", () => {
  it("un solo día cuenta 1", () => {
    expect(diasDelRango("2026-09-17", "2026-09-17")).toBe(1);
  });

  it("cuenta ambos extremos", () => {
    expect(diasDelRango("2026-09-17", "2026-09-23")).toBe(7);
  });

  it("cruza fin de mes y de año", () => {
    expect(diasDelRango("2026-09-28", "2026-10-03")).toBe(6);
    expect(diasDelRango("2026-12-30", "2027-01-02")).toBe(4);
  });

  it("año bisiesto", () => {
    expect(diasDelRango("2028-02-27", "2028-03-01")).toBe(4);
  });
});

describe("cerrarRango", () => {
  it("clickear el mismo día deja un rango de un solo día", () => {
    // Éste es el caso que react-day-picker resolvía deseleccionando todo.
    expect(cerrarRango("2026-09-17", "2026-09-17")).toEqual({
      desde: "2026-09-17",
      hasta: "2026-09-17",
    });
  });

  it("ordena cuando el segundo clic es anterior al primero", () => {
    expect(cerrarRango("2026-09-17", "2026-09-10")).toEqual({
      desde: "2026-09-10",
      hasta: "2026-09-17",
    });
  });

  it("extiende hacia adelante", () => {
    expect(cerrarRango("2026-09-17", "2026-09-23")).toEqual({
      desde: "2026-09-17",
      hasta: "2026-09-23",
    });
  });

  it("sin inicio previo, el día clickeado es los dos extremos", () => {
    expect(cerrarRango(null, "2026-09-17")).toEqual({
      desde: "2026-09-17",
      hasta: "2026-09-17",
    });
  });
});

describe("etiquetaRangoFechas", () => {
  it("sin nada elegido devuelve el placeholder", () => {
    expect(etiquetaRangoFechas({ desde: null, hasta: null }, prefs(), "Todas las fechas"))
      .toBe("Todas las fechas");
  });

  // El nombre abreviado del mes depende de la versión de ICU del runtime
  // ("set." / "sept"), así que se afirma la forma, no la abreviatura exacta.
  it("un rango de un solo día se muestra como una sola fecha, sin guion", () => {
    const etiqueta = etiquetaRangoFechas({ desde: "2026-09-17", hasta: "2026-09-17" }, prefs(), "—");
    expect(etiqueta).toMatch(/^17 \S+ 2026$/);
  });

  it("un rango real nombra los dos días y no repite el año", () => {
    const etiqueta = etiquetaRangoFechas({ desde: "2026-09-17", hasta: "2026-09-23" }, prefs(), "—");
    expect(etiqueta).toMatch(/\b17\b/);
    expect(etiqueta).toMatch(/\b23\b/);
    // El año una sola vez: es lo que hace que la etiqueta entre en la barra de
    // filtros en vez de desbordarla.
    expect(etiqueta.match(/2026/g)).toHaveLength(1);
  });

  it("rangos abiertos de un lado se nombran explícitamente", () => {
    expect(etiquetaRangoFechas({ desde: "2026-09-17", hasta: null }, prefs(), "—"))
      .toMatch(/^Desde 17 \S+ 2026$/);
    expect(etiquetaRangoFechas({ desde: null, hasta: "2026-09-17" }, prefs(), "—"))
      .toMatch(/^Hasta 17 \S+ 2026$/);
  });

  it("el día elegido es el que se muestra, en cualquier zona", () => {
    // La regresión clásica: el "YYYY-MM-DD" se vuelve instante y se formatea
    // en otra zona, y sale el día anterior. Acá ida y vuelta usan la misma,
    // incluso en los extremos del planeta (UTC+14 y UTC-11).
    for (const zonaHoraria of ["America/Lima", "Pacific/Kiritimati", "Pacific/Midway", "UTC"]) {
      expect(etiquetaRangoFechas({ desde: "2026-09-17", hasta: "2026-09-17" }, prefs({ zonaHoraria }), "—"))
        .toMatch(/^17 \S+ 2026$/);
    }
  });
});
