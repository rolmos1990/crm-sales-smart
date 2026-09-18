import { describe, it, expect } from "vitest";
import {
  formatearFecha,
  formatearFechaCorta,
  formatearFechaHora,
  formatearFechaLarga,
  formatearFechaRelativa,
  formatearHora,
  PREFERENCIAS_FECHA_DEFAULT,
  type PreferenciasFecha,
} from "./formato";

const base: PreferenciasFecha = { ...PREFERENCIAS_FECHA_DEFAULT, zonaHoraria: "America/Panama" };
const con = (extra: Partial<PreferenciasFecha>): PreferenciasFecha => ({ ...base, ...extra });

// 21:00 del 17/09 en Panamá (UTC-5) = 02:00 del 18/09 en UTC.
const NOCHE = new Date("2026-09-18T02:00:00.000Z");

describe("la zona se honra de verdad", () => {
  it("el mismo instante cae en días distintos según la zona", () => {
    expect(formatearFecha(NOCHE, con({ zonaHoraria: "America/Panama" }))).toBe("17/09/2026");
    expect(formatearFecha(NOCHE, con({ zonaHoraria: "Europe/Madrid" }))).toBe("18/09/2026");
    expect(formatearFecha(NOCHE, con({ zonaHoraria: "UTC" }))).toBe("18/09/2026");
  });

  it("la hora también se traslada", () => {
    expect(formatearHora(NOCHE, con({ zonaHoraria: "America/Panama" }))).toBe("21:00");
    expect(formatearHora(NOCHE, con({ zonaHoraria: "Europe/Madrid" }))).toBe("04:00");
  });
});

describe("formatoFecha de la empresa manda sobre el orden del locale", () => {
  it("MM/DD/YYYY reordena aunque el locale sea es-PE", () => {
    // Intl con es-PE daría 17/09/2026: el reensamblado por patrón es lo que
    // hace que la preferencia del tenant se respete.
    expect(formatearFecha(NOCHE, con({ formatoFecha: "MM/DD/YYYY" }))).toBe("09/17/2026");
  });

  it("YYYY-MM-DD", () => {
    expect(formatearFecha(NOCHE, con({ formatoFecha: "YYYY-MM-DD" }))).toBe("2026-09-17");
  });

  it("DD/MM/YYYY es el default", () => {
    expect(formatearFecha(NOCHE, base)).toBe("17/09/2026");
  });
});

describe("formatoHora", () => {
  it("24h nunca emite am/pm", () => {
    const texto = formatearHora(NOCHE, con({ formatoHora: "24h" }));
    expect(texto).toBe("21:00");
    expect(texto.toLowerCase()).not.toMatch(/[ap]\.?\s?m/);
  });

  it("12h sí lo emite", () => {
    expect(formatearHora(NOCHE, con({ formatoHora: "12h" })).toLowerCase()).toMatch(/[ap]\.?\s?m/);
  });

  it("la medianoche en 24h es 00:00, no 24:00", () => {
    const medianoche = new Date("2026-09-17T05:00:00.000Z"); // 00:00 en Panamá
    expect(formatearHora(medianoche, con({ formatoHora: "24h" }))).toBe("00:00");
  });
});

describe("variantes de formato", () => {
  it("fecha + hora", () => {
    expect(formatearFechaHora(NOCHE, base)).toBe("17/09/2026 · 21:00");
  });

  it("larga usa el orden y los nombres del locale", () => {
    // Ojo: con el locale fijado en es-PE el mes sale como "setiembre", la
    // variante peruana. Es correcto para es-PE; si alguna vez se cambia el
    // locale por tenant, este test lo va a señalar.
    expect(formatearFechaLarga(NOCHE, base)).toBe("17 de setiembre de 2026");
    expect(formatearFechaLarga(NOCHE, con({ locale: "es-ES" }))).toBe("17 de septiembre de 2026");
  });

  it("corta reemplaza al viejo dd MMM yyyy", () => {
    expect(formatearFechaCorta(NOCHE, base)).toMatch(/17/);
    expect(formatearFechaCorta(NOCHE, base)).toMatch(/2026/);
  });
});

describe("valores vacíos e inválidos", () => {
  it.each([null, undefined, ""])("%s devuelve cadena vacía, no 'Invalid Date'", (v) => {
    expect(formatearFecha(v, base)).toBe("");
    expect(formatearFechaHora(v, base)).toBe("");
    expect(formatearHora(v, base)).toBe("");
  });

  it("una fecha inválida no explota", () => {
    expect(formatearFecha("no-es-una-fecha", base)).toBe("");
  });

  it("acepta string ISO y epoch además de Date", () => {
    expect(formatearFecha("2026-09-18T02:00:00.000Z", base)).toBe("17/09/2026");
    expect(formatearFecha(NOCHE.getTime(), base)).toBe("17/09/2026");
  });
});

describe("formatearFechaRelativa — agrupa por día calendario, no por milisegundos", () => {
  const ref = new Date("2026-09-17T19:00:00.000Z"); // 14:00 del 17 en Panamá

  it("el mismo día es 'hoy' aunque falten muchas horas", () => {
    expect(formatearFechaRelativa(new Date("2026-09-18T02:00:00.000Z"), base, ref)).toBe("hoy");
  });

  it("ayer es 'ayer' aunque hayan pasado menos de 24 h", () => {
    // 22:00 del 16 en Panamá: 19 h antes de la referencia, pero es el día anterior.
    expect(formatearFechaRelativa(new Date("2026-09-17T03:00:00.000Z"), base, ref)).toBe("ayer");
  });

  it("mañana es 'mañana'", () => {
    expect(formatearFechaRelativa(new Date("2026-09-18T19:00:00.000Z"), base, ref)).toBe("mañana");
  });

  it("varios días atrás se expresa en días", () => {
    expect(formatearFechaRelativa(new Date("2026-09-14T19:00:00.000Z"), base, ref)).toMatch(/3 días/);
  });
});
