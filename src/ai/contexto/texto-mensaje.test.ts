import { describe, it, expect } from "vitest";
import {
  textoDeMensaje,
  textoDeMensajeODescarte,
  esTipoVoz,
  MARCADOR_VOZ_SIN_TRANSCRIBIR,
} from "./texto-mensaje";

/**
 * 049 — Única definición de "qué texto lee la IA de un mensaje", compartida
 * por el contexto del agente, el gate de autonomía y los Workflows.
 *
 * El caso que esta feature corrige: hasta ahora una nota de voz quedaba fuera
 * del prompt y el agente respondía como si el cliente no hubiera dicho nada.
 */

const AUDIO_TRANSCRITO = {
  contenido: null,
  tipo: "NOTA_VOZ",
  mediaArchivo: { transcripcion: "quería el precio del combo", transcripcionEstado: "LISTO" },
};

describe("textoDeMensaje", () => {
  it("un mensaje de texto devuelve su contenido", () => {
    expect(textoDeMensaje({ contenido: "hola", tipo: "TEXTO" })).toBe("hola");
  });

  it("una nota de voz transcrita devuelve el texto marcado como voz", () => {
    // El prefijo importa: el agente tiene que saber que el cliente HABLÓ.
    // Una respuesta que lo trata como texto escrito suena fuera de lugar.
    expect(textoDeMensaje(AUDIO_TRANSCRITO)).toBe("[nota de voz] quería el precio del combo");
  });

  it("'Inaudible' se entrega como cualquier otra transcripción", () => {
    const r = textoDeMensaje({
      contenido: null,
      tipo: "NOTA_VOZ",
      mediaArchivo: { transcripcion: "Inaudible", transcripcionEstado: "INAUDIBLE" },
    });
    expect(r).toBe("[nota de voz] Inaudible");
  });

  it("una nota de voz sin transcribir devuelve null", () => {
    expect(
      textoDeMensaje({ contenido: null, tipo: "AUDIO", mediaArchivo: { transcripcion: null } }),
    ).toBeNull();
  });

  it("un mensaje vacío que NO es de voz devuelve null", () => {
    expect(textoDeMensaje({ contenido: null, tipo: "IMAGEN" })).toBeNull();
    expect(textoDeMensaje({ contenido: "   ", tipo: "TEXTO" })).toBeNull();
  });

  it("el contenido propio gana sobre la transcripción", () => {
    const r = textoDeMensaje({ ...AUDIO_TRANSCRITO, contenido: "texto del canal" });
    expect(r).toBe("texto del canal");
  });

  it("NO toma la transcripción de un mensaje que no es de voz", () => {
    // Un video con transcripción colgada (no debería existir, pero si
    // existiera) no entra al prompt como si el cliente hubiera hablado.
    const r = textoDeMensaje({
      contenido: null,
      tipo: "VIDEO",
      mediaArchivo: { transcripcion: "audio del video", transcripcionEstado: "LISTO" },
    });
    expect(r).toBeNull();
  });
});

describe("textoDeMensajeODescarte", () => {
  it("una nota de voz sin transcribir entra como MARCADOR, no se descarta", () => {
    // FR-027: si desapareciera, el agente respondería en el vacío — el
    // comportamiento exacto que esta feature corrige.
    const r = textoDeMensajeODescarte({ contenido: null, tipo: "NOTA_VOZ", mediaArchivo: null });
    expect(r).toBe(MARCADOR_VOZ_SIN_TRANSCRIBIR);
  });

  it("una imagen sin texto sigue descartándose", () => {
    expect(textoDeMensajeODescarte({ contenido: null, tipo: "IMAGEN" })).toBeNull();
  });

  it("una nota de voz transcrita entra con su texto, no con el marcador", () => {
    expect(textoDeMensajeODescarte(AUDIO_TRANSCRITO)).toContain("precio del combo");
  });
});

describe("esTipoVoz", () => {
  it("reconoce AUDIO y NOTA_VOZ, y nada más", () => {
    expect(esTipoVoz("AUDIO")).toBe(true);
    expect(esTipoVoz("NOTA_VOZ")).toBe(true);
    expect(esTipoVoz("VIDEO")).toBe(false);
    expect(esTipoVoz("TEXTO")).toBe(false);
    expect(esTipoVoz(null)).toBe(false);
    expect(esTipoVoz(undefined)).toBe(false);
  });
});
