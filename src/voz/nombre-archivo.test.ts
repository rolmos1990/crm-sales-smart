import { describe, expect, it } from "vitest";
import { nombreConExtension } from "./nombre-archivo";

const CLAVE_MP4 = "cmsxugqtt00030ipj7gg5jybb/conversaciones/originals/1795268255346-m56krsk.mp4";
const CLAVE_OGG = "cmsxugqtt00030ipj7gg5jybb/conversaciones/originals/1795268255346-m56krsk.ogg";

describe("nombreConExtension", () => {
  it("agrega la extensión de la clave cuando el nombre no la trae", () => {
    // El caso real: Instagram entrega las notas de voz sin nombre de archivo.
    expect(nombreConExtension("audio-1795275488865", CLAVE_MP4)).toBe("audio-1795275488865.mp4");
  });

  it("sirve igual para los audios de WhatsApp", () => {
    expect(nombreConExtension("audio-1795266746093", CLAVE_OGG)).toBe("audio-1795266746093.ogg");
  });

  it("no toca un nombre que ya termina en la extensión de la clave", () => {
    expect(nombreConExtension("nota.mp4", CLAVE_MP4)).toBe("nota.mp4");
    expect(nombreConExtension("nota.MP4", CLAVE_MP4)).toBe("nota.MP4");
  });

  it("agrega la extensión de la clave sobre un nombre que trae OTRA", () => {
    // La clave refleja lo que el archivo realmente es; el nombre es un dato
    // suelto del canal. Mandar un mp4 llamado .mp3 es pedirle al proveedor que
    // lo interprete mal.
    expect(nombreConExtension("nota.mp3", CLAVE_MP4)).toBe("nota.mp3.mp4");
  });

  it("devuelve el nombre sin tocar cuando la clave tampoco trae extensión", () => {
    // Se degrada al comportamiento anterior a 051, no a algo peor: el proveedor
    // rechaza y el error ES correcto. Nunca se inventa una extensión.
    expect(nombreConExtension("audio-123", "instancia/conversaciones/originals/sinpunto")).toBe(
      "audio-123",
    );
  });

  it("devuelve el nombre sin tocar cuando no hay clave", () => {
    expect(nombreConExtension("audio-123", null)).toBe("audio-123");
  });

  it("usa 'audio' como base si el nombre viene vacío", () => {
    expect(nombreConExtension("", CLAVE_MP4)).toBe("audio.mp4");
    expect(nombreConExtension("   ", CLAVE_MP4)).toBe("audio.mp4");
  });

  it("normaliza la extensión a minúsculas", () => {
    // Los proveedores comparan contra una lista en minúsculas.
    expect(nombreConExtension("audio-123", "instancia/x/y/ARCHIVO.MP4")).toBe("audio-123.mp4");
  });

  it("agrega la extensión aunque el nombre tenga puntos decorativos", () => {
    // Decisión explícita: cualquier heurística de "¿ya tiene extensión?" se
    // equivoca con algún nombre con puntos. Se elige equivocarse del lado de
    // AGREGAR, porque agregarla de más deja un nombre feo y no agregarla deja
    // un audio sin transcribir.
    expect(nombreConExtension("archivo.de.audio", CLAVE_OGG)).toBe("archivo.de.audio.ogg");
  });

  it("no duplica la extensión en una segunda pasada", () => {
    // Idempotencia: el resultado de la función es un punto fijo.
    const una = nombreConExtension("audio-123", CLAVE_MP4);
    expect(nombreConExtension(una, CLAVE_MP4)).toBe(una);
  });
});
