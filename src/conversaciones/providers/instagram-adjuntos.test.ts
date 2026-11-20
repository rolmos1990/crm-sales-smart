import { describe, expect, it } from "vitest";
import { clasificarAdjuntoInstagram, textoDescriptivo, TEXTO_HISTORICO_NO_DISPONIBLE } from "./instagram-adjuntos";

describe("clasificarAdjuntoInstagram", () => {
  it.each([
    ["image", "DIRECTA"],
    ["video", "DIRECTA"],
    ["audio", "DIRECTA"],
    ["file", "DIRECTA"],
    ["ig_reel", "REEL"],
    ["reel", "REEL"],
    ["share", "PUBLICACION"],
    ["ig_post", "PUBLICACION"],
    ["media", "PUBLICACION"],
    ["story_mention", "MENCION_HISTORIA"],
    ["story", "MENCION_HISTORIA"],
    ["ig_story", "MENCION_HISTORIA"],
    ["ephemeral", "EFIMERO"],
    ["template", "NO_ADMITIDO"],
    ["fallback", "NO_ADMITIDO"],
    ["algo_que_meta_invente_mañana", "NO_ADMITIDO"],
  ])("%s → %s", (tipo, familia) => {
    expect(clasificarAdjuntoInstagram(tipo)).toBe(familia);
  });

  it("sin type → NO_ADMITIDO", () => {
    expect(clasificarAdjuntoInstagram(undefined)).toBe("NO_ADMITIDO");
  });

  it("is_unsupported manda sobre el type", () => {
    expect(clasificarAdjuntoInstagram("image", true)).toBe("NO_ADMITIDO");
  });
});

describe("textoDescriptivo (contracts/texto-descriptivo.md)", () => {
  it("DIRECTA no lleva texto", () => {
    expect(textoDescriptivo("DIRECTA")).toBeUndefined();
  });

  it("Reel con y sin título", () => {
    expect(textoDescriptivo("REEL")).toBe("Compartió un Reel");
    expect(textoDescriptivo("REEL", { titulo: "Zapatillas nuevas" })).toBe("Compartió un Reel: «Zapatillas nuevas»");
    expect(textoDescriptivo("REEL", { titulo: "   " })).toBe("Compartió un Reel");
  });

  it("el título se recorta a 200 caracteres", () => {
    const largo = "a".repeat(250);
    expect(textoDescriptivo("REEL", { titulo: largo })).toBe(`Compartió un Reel: «${"a".repeat(200)}»`);
  });

  it("Reel nunca lleva sufijo de fallo", () => {
    expect(textoDescriptivo("REEL", { fallo: true })).toBe("Compartió un Reel");
  });

  it("publicación: ok, con título y con fallo", () => {
    expect(textoDescriptivo("PUBLICACION")).toBe("Compartió una publicación");
    expect(textoDescriptivo("PUBLICACION", { titulo: "Promo" })).toBe("Compartió una publicación: «Promo»");
    expect(textoDescriptivo("PUBLICACION", { fallo: true })).toBe(
      "Compartió una publicación (no se pudo guardar la imagen)",
    );
    expect(textoDescriptivo("PUBLICACION", { titulo: "Promo", fallo: true })).toBe(
      "Compartió una publicación: «Promo» (no se pudo guardar la imagen)",
    );
  });

  it("mención en historia: ok y con fallo", () => {
    expect(textoDescriptivo("MENCION_HISTORIA")).toBe("Te mencionó en su historia");
    expect(textoDescriptivo("MENCION_HISTORIA", { fallo: true })).toBe(
      "Te mencionó en su historia (no se pudo guardar la imagen)",
    );
  });

  it("respuesta a historia: con texto, sin texto y nunca con sufijo de fallo", () => {
    expect(textoDescriptivo("RESPUESTA_HISTORIA", { texto: "hola" })).toBe("Respondió a tu historia: hola");
    expect(textoDescriptivo("RESPUESTA_HISTORIA")).toBe("Respondió a tu historia");
    expect(textoDescriptivo("RESPUESTA_HISTORIA", { texto: "hola", fallo: true })).toBe("Respondió a tu historia: hola");
  });

  it("efímero", () => {
    expect(textoDescriptivo("EFIMERO")).toBe("Envió contenido temporal que no puede guardarse");
  });

  it("no admitido por canal", () => {
    expect(textoDescriptivo("NO_ADMITIDO")).toBe("Envió un contenido que Instagram no permite mostrar");
    expect(textoDescriptivo("NO_ADMITIDO", { canal: "facebook_messenger" })).toBe(
      "Envió un contenido que Messenger no permite mostrar",
    );
  });

  it("texto del histórico limpiado", () => {
    expect(TEXTO_HISTORICO_NO_DISPONIBLE).toBe("Contenido compartido que ya no está disponible");
  });
});
