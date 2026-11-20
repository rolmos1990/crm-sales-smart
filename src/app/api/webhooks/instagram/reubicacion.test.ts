import { describe, expect, it } from "vitest";
import type { MensajeEntranteNormalizado } from "@/conversaciones/types";
import { prepararPayloadEntrante } from "./reubicacion";

const URL_META = "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1&signature=abc";

function normalizado(extra: Partial<MensajeEntranteNormalizado> = {}): MensajeEntranteNormalizado {
  return {
    canal: "instagram",
    identificadorContacto: "igsid1",
    cuentaCanalId: "cc1",
    tipo: "VIDEO",
    idExterno: "mid1",
    mediaUrl: URL_META,
    familiaAdjunto: "DIRECTA",
    ...extra,
  };
}

describe("prepararPayloadEntrante — FR-001: nunca una URL de Meta", () => {
  it("resultado ok → URL propia, mime y mediaArchivoId del resultado", () => {
    const salida = prepararPayloadEntrante(normalizado(), {
      ok: true,
      url: "/cdn/inst1/conversaciones/originals/v.mp4",
      mimeType: "video/mp4",
      mediaArchivoId: "ma1",
    });
    expect(salida.mediaUrl).toBe("/cdn/inst1/conversaciones/originals/v.mp4");
    expect(salida.mediaMimeType).toBe("video/mp4");
    expect(salida.mediaArchivoId).toBe("ma1");
    expect(salida.tipo).toBe("VIDEO");
  });

  it.each([
    ["FALLO", { ok: false as const, motivo: "FALLO" as const }],
    ["null", null],
  ])("resultado %s → sin mediaUrl", (_nombre, resultado) => {
    const salida = prepararPayloadEntrante(normalizado(), resultado);
    expect(salida.mediaUrl).toBeUndefined();
    expect(JSON.stringify(salida)).not.toContain("fbsbx");
  });

  it("regresión: media directa que falla conserva su tipo y no recibe contenido", () => {
    const salida = prepararPayloadEntrante(normalizado(), { ok: false, motivo: "FALLO" });
    expect(salida.tipo).toBe("VIDEO");
    expect(salida.contenido).toBeUndefined();
  });

  it("nunca publica los campos internos", () => {
    const salida = prepararPayloadEntrante(normalizado(), null);
    expect(salida).not.toHaveProperty("familiaAdjunto");
  });

  it("no muta el normalizado de entrada", () => {
    const entrada = normalizado();
    prepararPayloadEntrante(entrada, null);
    expect(entrada.mediaUrl).toBe(URL_META);
    expect(entrada.familiaAdjunto).toBe("DIRECTA");
  });

  it("nunca publica tituloAdjunto", () => {
    const salida = prepararPayloadEntrante(normalizado({ familiaAdjunto: "PUBLICACION", tituloAdjunto: "Promo" }), null);
    expect(salida).not.toHaveProperty("tituloAdjunto");
  });

  it("mensaje de texto sin adjunto pasa intacto", () => {
    const salida = prepararPayloadEntrante(
      normalizado({ tipo: "TEXTO", contenido: "hola", mediaUrl: undefined, familiaAdjunto: undefined }),
      null,
    );
    expect(salida).toMatchObject({ tipo: "TEXTO", contenido: "hola", mediaUrl: undefined });
  });
});

describe("prepararPayloadEntrante — contenido compartido (US3)", () => {
  const ok = { ok: true as const, url: "/cdn/inst1/conversaciones/img.webp", mimeType: "image/webp", mediaArchivoId: "ma2" };
  const fallo = { ok: false as const, motivo: "FALLO" as const };
  const noEsImagen = { ok: false as const, motivo: "NO_ES_IMAGEN" as const };

  const casos = [
    {
      familia: "PUBLICACION" as const,
      contenido: "Compartió una publicación: «Promo»",
      tituloAdjunto: "Promo",
      conFallo: "Compartió una publicación: «Promo» (no se pudo guardar la imagen)",
    },
    {
      familia: "MENCION_HISTORIA" as const,
      contenido: "Te mencionó en su historia",
      tituloAdjunto: undefined,
      conFallo: "Te mencionó en su historia (no se pudo guardar la imagen)",
    },
    {
      familia: "RESPUESTA_HISTORIA" as const,
      contenido: "Respondió a tu historia: hola",
      tituloAdjunto: undefined,
      conFallo: "Respondió a tu historia: hola",
    },
  ];

  function compartido(c: (typeof casos)[number]) {
    return normalizado({ tipo: "IMAGEN", familiaAdjunto: c.familia, contenido: c.contenido, tituloAdjunto: c.tituloAdjunto });
  }

  it.each(casos)("$familia + imagen guardada → IMAGEN con media y el mismo texto", (c) => {
    const salida = prepararPayloadEntrante(compartido(c), ok);
    expect(salida).toMatchObject({ tipo: "IMAGEN", mediaUrl: ok.url, mediaArchivoId: "ma2", contenido: c.contenido });
  });

  it.each(casos)("$familia + no era imagen (video) → TEXTO sin aclaración de fallo", (c) => {
    const salida = prepararPayloadEntrante(compartido(c), noEsImagen);
    expect(salida).toMatchObject({ tipo: "TEXTO", contenido: c.contenido });
    expect(salida.mediaUrl).toBeUndefined();
  });

  it.each(casos)("$familia + FALLO → TEXTO con aclaración (salvo en la respuesta)", (c) => {
    const salida = prepararPayloadEntrante(compartido(c), fallo);
    expect(salida).toMatchObject({ tipo: "TEXTO", contenido: c.conFallo });
    expect(salida.mediaUrl).toBeUndefined();
  });

  it.each(casos)("$familia + sin descarga (null) → TEXTO con el texto original", (c) => {
    const salida = prepararPayloadEntrante(compartido(c), null);
    expect(salida).toMatchObject({ tipo: "TEXTO", contenido: c.contenido });
    expect(salida.mediaUrl).toBeUndefined();
  });

  it("Reel: pasa como texto, sin media", () => {
    const salida = prepararPayloadEntrante(
      normalizado({ tipo: "TEXTO", familiaAdjunto: "REEL", contenido: "Compartió un Reel", mediaUrl: undefined }),
      null,
    );
    expect(salida).toMatchObject({ tipo: "TEXTO", contenido: "Compartió un Reel" });
    expect(salida.mediaUrl).toBeUndefined();
  });
});
