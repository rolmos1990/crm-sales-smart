import { describe, it, expect } from "vitest";
import {
  aFechaCalendario,
  aFechaHoraLocal,
  aInstante,
  desdeFechaCalendario,
  diasDeDiferenciaEnZona,
  esHoyEnZona,
  esMananaEnZona,
  esPasadoEnZona,
  esZonaHorariaValida,
  fechaYMDEnZona,
  inicioDiaEnZona,
  rangoDiaEnZona,
  resolverZonaPresentacion,
  sumarDias,
} from "./zona";
import { ZONAS_HORARIAS } from "./zonas-catalogo";

// 23:30 del 17/09 en Lima (UTC-5) — a propósito cerca de medianoche: es el
// punto donde un cálculo hecho en la zona del servidor da un día distinto.
const REF_LIMA = new Date("2026-09-18T04:30:00.000Z");
// 00:30 del 18/09 en Madrid (UTC+2) — cruza el día en el sentido contrario.
const REF_MADRID = new Date("2026-09-17T22:30:00.000Z");

const MS_HORA = 3_600_000;

describe("esZonaHorariaValida", () => {
  it("acepta identificadores IANA", () => {
    expect(esZonaHorariaValida("America/Panama")).toBe(true);
    expect(esZonaHorariaValida("Europe/Madrid")).toBe(true);
    expect(esZonaHorariaValida("America/Argentina/Buenos_Aires")).toBe(true);
  });

  it("acepta UTC — no está en Intl.supportedValuesOf pero Intl sí lo soporta", () => {
    expect(esZonaHorariaValida("UTC")).toBe(true);
  });

  it("rechaza offsets fijos: no contemplan el horario de verano", () => {
    expect(esZonaHorariaValida("UTC-5")).toBe(false);
    expect(esZonaHorariaValida("GMT-5")).toBe(false);
  });

  it("rechaza basura, vacío y nulos sin lanzar", () => {
    expect(esZonaHorariaValida("No/Existe")).toBe(false);
    expect(esZonaHorariaValida("")).toBe(false);
    expect(esZonaHorariaValida(null)).toBe(false);
    expect(esZonaHorariaValida(undefined)).toBe(false);
  });

  it("rechaza cadenas fuera del charset antes de pasarlas a ICU", () => {
    expect(esZonaHorariaValida("../../etc/passwd")).toBe(false);
    expect(esZonaHorariaValida("a".repeat(200))).toBe(false);
  });
});

describe("aFechaCalendario — el off-by-one que rompe toISOString().slice(0,10)", () => {
  it("lee el día en la zona pedida, no en UTC", () => {
    // 21:00 del 17/09 en Panamá (UTC-5) = 02:00 del 18/09 en UTC.
    const instante = new Date("2026-09-18T02:00:00.000Z");
    expect(aFechaCalendario(instante, "America/Panama")).toBe("2026-09-17");
    // Esto es exactamente lo que hacía el código viejo, y por qué fallaba:
    expect(instante.toISOString().slice(0, 10)).toBe("2026-09-18");
  });

  it("round-trip identidad en todas las zonas del catálogo", () => {
    for (const { valor: zona } of ZONAS_HORARIAS) {
      for (const ymd of ["2026-01-01", "2026-06-15", "2026-09-17", "2026-12-31"]) {
        expect(aFechaCalendario(desdeFechaCalendario(ymd, zona), zona)).toBe(ymd);
      }
    }
  });
});

describe("inicioDiaEnZona — bordes de horario de verano", () => {
  it("fall-back en America/Santiago (2026-04-05): no cae al día anterior", () => {
    // Ese día la medianoche local ocurre dos veces. La corrección de una sola
    // pasada devolvía las 23:00 del 04/04.
    const inicio = inicioDiaEnZona({ anio: 2026, mes: 4, dia: 5 }, "America/Santiago");
    expect(fechaYMDEnZona(inicio, "America/Santiago")).toBe("2026-04-05");
    expect(inicio.toISOString()).toBe("2026-04-05T04:00:00.000Z");
  });

  it("el día del fall-back (2026-04-04 en Santiago) dura 25 horas", () => {
    const { desde, hasta } = rangoDiaEnZona("America/Santiago", 0, new Date("2026-04-04T12:00:00.000Z"));
    expect((hasta.getTime() - desde.getTime()) / MS_HORA).toBe(25);
  });

  it("spring-forward en America/Santiago (2026-09-06): la medianoche no existe", () => {
    // Santiago salta de 00:00 a 01:00. Debe devolverse el primer instante real
    // del día, nunca el día anterior.
    const inicio = inicioDiaEnZona({ anio: 2026, mes: 9, dia: 6 }, "America/Santiago");
    expect(fechaYMDEnZona(inicio, "America/Santiago")).toBe("2026-09-06");
    expect(inicio.toISOString()).toBe("2026-09-06T04:00:00.000Z");
  });

  it("spring-forward: ese día dura 23 horas", () => {
    const { desde, hasta } = rangoDiaEnZona("America/Santiago", 0, new Date("2026-09-06T12:00:00.000Z"));
    expect((hasta.getTime() - desde.getTime()) / MS_HORA).toBe(23);
  });

  it("Europe/Madrid en sus dos transiciones sigue dando medianoche local", () => {
    for (const [mes, dia, esperado] of [[3, 29, "2026-03-28T23:00:00.000Z"], [10, 25, "2026-10-24T22:00:00.000Z"]] as const) {
      const inicio = inicioDiaEnZona({ anio: 2026, mes, dia }, "Europe/Madrid");
      expect(inicio.toISOString()).toBe(esperado);
      expect(fechaYMDEnZona(inicio, "Europe/Madrid")).toBe(`2026-${String(mes).padStart(2, "0")}-${dia}`);
    }
  });

  it("zona sin horario de verano: medianoche exacta", () => {
    expect(inicioDiaEnZona({ anio: 2026, mes: 9, dia: 17 }, "America/Panama").toISOString())
      .toBe("2026-09-17T05:00:00.000Z");
  });
});

describe("propiedad: los días son contiguos y monótonos", () => {
  // La prueba más barata y más fuerte — cubre todos los bordes de DST de todas
  // las zonas del catálogo sin tener que enumerarlos uno por uno.
  it("400 días consecutivos en cada zona del catálogo", { timeout: 30_000 }, () => {
    for (const { valor: zona } of ZONAS_HORARIAS) {
      let ymd = { anio: 2026, mes: 1, dia: 1 };
      let anterior = inicioDiaEnZona(ymd, zona);
      for (let i = 0; i < 400; i++) {
        const siguienteYmd = sumarDias(ymd, 1);
        const siguiente = inicioDiaEnZona(siguienteYmd, zona);

        // Monotonía estricta: nunca retrocede (el bug de una pasada sí lo hacía).
        expect(siguiente.getTime()).toBeGreaterThan(anterior.getTime());
        // Ningún día dura menos de 23 h ni más de 25 h.
        const horas = (siguiente.getTime() - anterior.getTime()) / MS_HORA;
        expect(horas).toBeGreaterThanOrEqual(23);
        expect(horas).toBeLessThanOrEqual(25);
        // El instante devuelto pertenece al día pedido, no al anterior.
        expect(fechaYMDEnZona(siguiente, zona)).toBe(
          `${siguienteYmd.anio}-${String(siguienteYmd.mes).padStart(2, "0")}-${String(siguienteYmd.dia).padStart(2, "0")}`,
        );

        ymd = siguienteYmd;
        anterior = siguiente;
      }
    }
  });

  it("rangoDiaEnZona: hoy y mañana son contiguos, incluso cruzando un cambio de horario", () => {
    for (const [zona, ref] of [
      ["America/Santiago", new Date("2026-04-04T12:00:00.000Z")],
      ["America/Santiago", new Date("2026-09-06T12:00:00.000Z")],
      ["Europe/Madrid", new Date("2026-10-25T12:00:00.000Z")],
      ["America/Panama", new Date("2026-09-17T12:00:00.000Z")],
    ] as const) {
      const hoy = rangoDiaEnZona(zona, 0, ref);
      const manana = rangoDiaEnZona(zona, 1, ref);
      expect(hoy.hasta.toISOString()).toBe(manana.desde.toISOString());
    }
  });
});

describe("aInstante / aFechaHoraLocal — la simetría que form-actividad rompía", () => {
  it("interpreta la hora de pared en la zona dada", () => {
    expect(aInstante("2026-09-17T14:30", "America/Panama").toISOString())
      .toBe("2026-09-17T19:30:00.000Z");
    expect(aInstante("2026-09-17T14:30", "Europe/Madrid").toISOString())
      .toBe("2026-09-17T12:30:00.000Z");
  });

  it("no deriva al repetir el round-trip — el bug corría la hora en CADA edición", () => {
    for (const zona of ["America/Panama", "Europe/Madrid", "America/Santiago", "UTC"]) {
      let valor = "2026-09-17T14:30";
      for (let i = 0; i < 3; i++) valor = aFechaHoraLocal(aInstante(valor, zona), zona);
      expect(valor).toBe("2026-09-17T14:30");
    }
  });

  it("aFechaHoraLocal usa reloj de 24h, no el de UTC", () => {
    const instante = new Date("2026-09-18T02:00:00.000Z");
    expect(aFechaHoraLocal(instante, "America/Panama")).toBe("2026-09-17T21:00");
    // Lo que hacía el código viejo, y por qué se corría:
    expect(instante.toISOString().slice(0, 16)).toBe("2026-09-18T02:00");
  });
});

describe("comparaciones por día calendario", () => {
  it("diasDeDiferenciaEnZona cuenta días, no múltiplos de 24 h", () => {
    // 23:30 y 00:30 están a una hora, pero son días calendario distintos.
    const a = new Date("2026-09-18T04:30:00.000Z"); // 23:30 del 17 en Lima
    const b = new Date("2026-09-18T05:30:00.000Z"); // 00:30 del 18 en Lima
    expect(diasDeDiferenciaEnZona(b, a, "America/Lima")).toBe(1);
  });

  it("atraviesa un cambio de horario sin desviarse", () => {
    const antes = new Date("2026-04-04T16:00:00.000Z");
    const despues = new Date("2026-04-06T16:00:00.000Z");
    expect(diasDeDiferenciaEnZona(despues, antes, "America/Santiago")).toBe(2);
  });

  it("esHoy / esMañana / esPasado en la zona dada", () => {
    const hoy = new Date("2026-09-18T04:00:00.000Z"); // 23:00 del 17 en Lima
    expect(esHoyEnZona(hoy, "America/Lima", REF_LIMA)).toBe(true);
    expect(esMananaEnZona(new Date("2026-09-18T20:00:00.000Z"), "America/Lima", REF_LIMA)).toBe(true);
    expect(esPasadoEnZona(new Date("2026-09-16T20:00:00.000Z"), "America/Lima", REF_LIMA)).toBe(true);
    expect(esPasadoEnZona(hoy, "America/Lima", REF_LIMA)).toBe(false);
  });

  it("el mismo instante cae en días distintos según la zona", () => {
    expect(fechaYMDEnZona(REF_MADRID, "Europe/Madrid")).toBe("2026-09-18");
    expect(fechaYMDEnZona(REF_MADRID, "America/Panama")).toBe("2026-09-17");
  });
});

describe("resolverZonaPresentacion", () => {
  it("el caso del requisito: usuario en España administrando empresa de Panamá", () => {
    // Sin zona de usuario explícita, la empresa gana al navegador.
    expect(resolverZonaPresentacion({
      zonaUsuario: null,
      zonaEmpresa: "America/Panama",
      zonaNavegador: "Europe/Madrid",
    })).toBe("America/Panama");
  });

  it("la zona de usuario tiene prioridad sobre la de empresa", () => {
    expect(resolverZonaPresentacion({
      zonaUsuario: "Europe/Madrid",
      zonaEmpresa: "America/Panama",
      zonaNavegador: "America/New_York",
    })).toBe("Europe/Madrid");
  });

  it("el navegador solo gana cuando no hay usuario ni empresa", () => {
    expect(resolverZonaPresentacion({ zonaNavegador: "Europe/Madrid" })).toBe("Europe/Madrid");
  });

  it("sin ninguna entrada cae a UTC", () => {
    expect(resolverZonaPresentacion({})).toBe("UTC");
    expect(resolverZonaPresentacion({ zonaUsuario: null, zonaEmpresa: null, zonaNavegador: null })).toBe("UTC");
  });

  it("una zona inválida se salta sin cortocircuitar los niveles inferiores", () => {
    expect(resolverZonaPresentacion({
      zonaUsuario: "UTC-5",
      zonaEmpresa: "America/Panama",
    })).toBe("America/Panama");

    expect(resolverZonaPresentacion({
      zonaUsuario: "basura",
      zonaEmpresa: "tambien/basura",
      zonaNavegador: "Europe/Madrid",
    })).toBe("Europe/Madrid");
  });

  it("las 8 combinaciones de presencia resuelven al nivel más alto válido", () => {
    const U = "Europe/Madrid", E = "America/Panama", N = "America/New_York";
    expect(resolverZonaPresentacion({ zonaUsuario: U, zonaEmpresa: E, zonaNavegador: N })).toBe(U);
    expect(resolverZonaPresentacion({ zonaUsuario: U, zonaEmpresa: E })).toBe(U);
    expect(resolverZonaPresentacion({ zonaUsuario: U, zonaNavegador: N })).toBe(U);
    expect(resolverZonaPresentacion({ zonaUsuario: U })).toBe(U);
    expect(resolverZonaPresentacion({ zonaEmpresa: E, zonaNavegador: N })).toBe(E);
    expect(resolverZonaPresentacion({ zonaEmpresa: E })).toBe(E);
    expect(resolverZonaPresentacion({ zonaNavegador: N })).toBe(N);
    expect(resolverZonaPresentacion({})).toBe("UTC");
  });
});
