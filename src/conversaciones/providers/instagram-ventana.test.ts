import { describe, expect, it } from "vitest";
import { obtenerEstadoVentanaMensajeria } from "./instagram-ventana";

const AHORA = new Date("2026-08-22T12:00:00.000Z");
const horasAntes = (h: number) => new Date(AHORA.getTime() - h * 60 * 60 * 1000);

describe("obtenerEstadoVentanaMensajeria", () => {
  it("Caso A — el contacto escribió hace 5 minutos → VENTANA_NORMAL", () => {
    const ultimo = new Date(AHORA.getTime() - 5 * 60 * 1000);
    expect(obtenerEstadoVentanaMensajeria(ultimo, AHORA)).toBe("VENTANA_NORMAL");
  });

  it("Caso B — el contacto escribió hace 5 horas → VENTANA_NORMAL", () => {
    expect(obtenerEstadoVentanaMensajeria(horasAntes(5), AHORA)).toBe("VENTANA_NORMAL");
  });

  it("exactamente 24h → todavía VENTANA_NORMAL (límite inclusivo)", () => {
    expect(obtenerEstadoVentanaMensajeria(horasAntes(24), AHORA)).toBe("VENTANA_NORMAL");
  });

  it("Caso C/D — el contacto escribió hace 30 horas → HUMAN_AGENT (la decisión de usarlo o no es de quien llama, según la capability)", () => {
    expect(obtenerEstadoVentanaMensajeria(horasAntes(30), AHORA)).toBe("HUMAN_AGENT");
  });

  it("exactamente 7 días → todavía HUMAN_AGENT (límite inclusivo)", () => {
    expect(obtenerEstadoVentanaMensajeria(horasAntes(24 * 7), AHORA)).toBe("HUMAN_AGENT");
  });

  it("Caso E — el contacto escribió hace más de 7 días → FUERA_DE_VENTANA", () => {
    expect(obtenerEstadoVentanaMensajeria(horasAntes(24 * 7 + 1), AHORA)).toBe("FUERA_DE_VENTANA");
  });

  it("el contacto nunca escribió (null) → FUERA_DE_VENTANA", () => {
    expect(obtenerEstadoVentanaMensajeria(null, AHORA)).toBe("FUERA_DE_VENTANA");
  });

  it("la respuesta de un agente NO reinicia la ventana — se calcula solo desde el último mensaje del contacto, que es lo único que recibe la función", () => {
    // Cliente escribe a las 10:00, agente responde a las 10:30 y de nuevo a
    // las 17:00 — la ventana sigue contando desde las 10:00 porque
    // obtenerEstadoVentanaMensajeria() nunca recibe la fecha de los
    // mensajes del agente, solo la del contacto (responsabilidad de quien
    // llama, ver EnviarMensajeSuscriptor: filtra remitente=CONTACTO).
    const mensajeCliente = new Date("2026-08-21T10:00:00.000Z");
    const ahoraTrasSegundaRespuesta = new Date("2026-08-21T17:00:00.000Z");
    expect(obtenerEstadoVentanaMensajeria(mensajeCliente, ahoraTrasSegundaRespuesta)).toBe("VENTANA_NORMAL");
  });
});
