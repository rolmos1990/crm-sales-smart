import { describe, expect, it } from "vitest";
import { limpiarCita } from "./limpiar-cita";

describe("recorte del hilo citado", () => {
  it("Gmail: corta en 'On ... wrote:' y deja solo lo nuevo", () => {
    const texto = [
      "Gracias, lo reviso y te confirmo.",
      "",
      "On Mon, Nov 10, 2026 at 9:00 AM Ventas <ventas@negocio.com> wrote:",
      "> Hola, te paso la cotización adjunta.",
      "> Saludos",
    ].join("\n");

    expect(limpiarCita(texto)).toBe("Gracias, lo reviso y te confirmo.");
  });

  it("cliente en español: corta en 'El ... escribió:'", () => {
    const texto = [
      "Perfecto, cerramos así.",
      "",
      "El 10 de noviembre de 2026, Ventas <ventas@negocio.com> escribió:",
      "> Te confirmo el precio final",
    ].join("\n");

    expect(limpiarCita(texto)).toBe("Perfecto, cerramos así.");
  });

  it("Outlook: corta en el separador de mensaje original", () => {
    const texto = [
      "Confirmado, mandá la factura.",
      "",
      "-----Mensaje original-----",
      "De: Ventas <ventas@negocio.com>",
      "Enviado: lunes, 10 de noviembre de 2026",
      "Asunto: Cotización",
      "",
      "Adjunto la cotización.",
    ].join("\n");

    expect(limpiarCita(texto)).toBe("Confirmado, mandá la factura.");
  });

  it("quita la firma separada con '-- '", () => {
    const texto = ["Dale, lo vemos mañana.", "", "-- ", "Juan Pérez", "Gerente Comercial"].join("\n");

    expect(limpiarCita(texto)).toBe("Dale, lo vemos mañana.");
  });

  it("un correo sin cita queda igual", () => {
    const texto = "Hola, quisiera cotizar 20 unidades del modelo A.";
    expect(limpiarCita(texto)).toBe(texto);
  });

  it("conserva los párrafos del remitente", () => {
    const texto = "Hola,\n\nNecesito 20 unidades.\n\nGracias.";
    expect(limpiarCita(texto)).toBe(texto);
  });

  it("si el recorte dejaría el texto vacío, devuelve el original", () => {
    // Un correo que es SOLO cita: perder el contenido sería peor que mostrarlo.
    const texto = ["On Mon, Nov 10, 2026 at 9:00 AM Ventas <v@n.com> wrote:", "> Hola"].join("\n");

    expect(limpiarCita(texto)).not.toBe("");
  });

  it("entrada vacía o nula no rompe", () => {
    expect(limpiarCita("")).toBe("");
    expect(limpiarCita(null)).toBe("");
    expect(limpiarCita(undefined)).toBe("");
  });

  it("colapsa las líneas en blanco de más que deja el recorte", () => {
    const texto = "Listo.\n\n\n\nGracias.\n\nOn Mon, Nov 10, 2026 at 9:00 AM A <a@b.com> wrote:\n> x";
    expect(limpiarCita(texto)).toBe("Listo.\n\nGracias.");
  });
});
