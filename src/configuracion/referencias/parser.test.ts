import { describe, expect, it } from "vitest";
import {
  construirBloqueReferencias,
  extraerReferencias,
  MAX_CARACTERES_CONTENIDO,
  reemplazarTokens,
  segmentarPorReferencias,
  sinReferencias,
} from "./parser";
import type { ReferenciaResuelta } from "./tipos";

function resuelta(tipo: string, clave: string, etiqueta: string, contenido = "contenido"): ReferenciaResuelta {
  return { tipo: tipo as ReferenciaResuelta["tipo"], clave, token: `@${tipo}:${clave}`, etiqueta, contenido };
}

const mapa = (...refs: ReferenciaResuelta[]) =>
  new Map(refs.map((r) => [`${r.tipo}:${r.clave}`, r]));

describe("extraerReferencias", () => {
  it("extrae los tres tipos", () => {
    const refs = extraerReferencias("@plantilla:metodos_envios @usuario:maria-lopez @producto:teclado-k380");
    expect(refs.map((r) => `${r.tipo}:${r.clave}`)).toEqual([
      "plantilla:metodos_envios",
      "usuario:maria-lopez",
      "producto:teclado-k380",
    ]);
  });

  it("deduplica conservando el orden de aparición", () => {
    const refs = extraerReferencias("usa @plantilla:b, luego @plantilla:a y de nuevo @plantilla:b");
    expect(refs.map((r) => r.clave)).toEqual(["b", "a"]);
  });

  it("corta el token en la puntuación que lo sigue", () => {
    const refs = extraerReferencias("respondé con @plantilla:metodos_envios. Después preguntá.");
    expect(refs).toHaveLength(1);
    expect(refs[0].token).toBe("@plantilla:metodos_envios");
  });

  it("ignora un tipo que no existe", () => {
    expect(extraerReferencias("@transportista:uno-express")).toEqual([]);
  });

  it("no confunde un email con una referencia", () => {
    expect(extraerReferencias("escribile a juan@plantilla:x")).toEqual([]);
    expect(extraerReferencias("soporte@empresa.com")).toEqual([]);
  });

  it("ignora un `@` suelto o sin clave", () => {
    expect(extraerReferencias("precio @ 100")).toEqual([]);
    expect(extraerReferencias("@plantilla:")).toEqual([]);
    expect(extraerReferencias("@plantilla")).toEqual([]);
  });

  it("texto sin `@` no se recorre siquiera", () => {
    expect(sinReferencias("instrucciones normales")).toBe(true);
    expect(extraerReferencias("instrucciones normales")).toEqual([]);
    expect(extraerReferencias(null)).toEqual([]);
    expect(extraerReferencias(undefined)).toEqual([]);
  });
});

describe("reemplazarTokens", () => {
  it("reemplaza el token resuelto por la etiqueta entre comillas angulares", () => {
    const texto = reemplazarTokens(
      "respondé siguiendo @plantilla:metodos_envios siempre",
      mapa(resuelta("plantilla", "metodos_envios", "Métodos de envío")),
    );
    expect(texto).toBe("respondé siguiendo «Métodos de envío» siempre");
  });

  it("deja literal el token que no resolvió — nunca rompe la frase", () => {
    const texto = reemplazarTokens("seguí @plantilla:no_existe y listo", new Map());
    expect(texto).toBe("seguí @plantilla:no_existe y listo");
  });

  it("reemplaza todas las apariciones del mismo token", () => {
    const texto = reemplazarTokens(
      "@plantilla:x arriba y @plantilla:x abajo",
      mapa(resuelta("plantilla", "x", "Equis")),
    );
    expect(texto).toBe("«Equis» arriba y «Equis» abajo");
  });
});

describe("construirBloqueReferencias", () => {
  it("sin referencias no genera bloque", () => {
    expect(construirBloqueReferencias([])).toBe("");
  });

  it("incluye cada contenido con su etiqueta y la nota sobre {{variables}}", () => {
    const bloque = construirBloqueReferencias([
      resuelta("plantilla", "envios", "Plantilla · Métodos de envío", "Hacemos envíos a todo el país."),
    ]);
    expect(bloque).toContain("[Plantilla · Métodos de envío]");
    expect(bloque).toContain("Hacemos envíos a todo el país.");
    expect(bloque).toContain("Los marcadores {{...}}");
  });

  it("trunca en vez de inflar el prompt sin aviso", () => {
    const largo = "x".repeat(MAX_CARACTERES_CONTENIDO * 2);
    const bloque = construirBloqueReferencias([resuelta("plantilla", "a", "A", largo)]);
    expect(bloque).toContain("…");
    expect(bloque.length).toBeLessThan(MAX_CARACTERES_CONTENIDO + 400);
  });

  it("al agotarse el tope deja de agregar referencias en vez de cortarlas a la mitad", () => {
    const bloque = construirBloqueReferencias([
      resuelta("plantilla", "a", "A", "y".repeat(MAX_CARACTERES_CONTENIDO)),
      resuelta("plantilla", "b", "B", "contenido de la segunda"),
    ]);
    expect(bloque).not.toContain("[B]");
    expect(bloque).toContain("[A]");
  });
});

describe("segmentarPorReferencias", () => {
  // La capa de resaltado se superpone al textarea carácter por carácter: si
  // los segmentos no reconstruyen el texto exacto, las dos capas se
  // desalinean y el cursor deja de caer donde se ve.
  const reconstruye = (texto: string) =>
    segmentarPorReferencias(texto)
      .map((s) => s.texto)
      .join("");

  it.each([
    "",
    "sin ninguna referencia",
    "@plantilla:envios",
    "antes @plantilla:envios después",
    "@plantilla:a@plantilla:b",
    "dos @plantilla:a y @usuario:maria-lopez juntas",
    "con salto\n@producto:teclado\nfinal",
    "pegada a puntuación: @plantilla:envios.",
    "un email juan@empresa.com no cuenta",
    "   espacios al borde   ",
  ])("reconstruye el texto exacto: %j", (texto) => {
    expect(reconstruye(texto)).toBe(texto);
  });

  it("marca como referencia solo los tokens", () => {
    const segmentos = segmentarPorReferencias("antes @plantilla:envios después");

    expect(segmentos).toEqual([
      { texto: "antes ", esReferencia: false },
      { texto: "@plantilla:envios", esReferencia: true },
      { texto: " después", esReferencia: false },
    ]);
  });

  it("un texto sin tokens es un único segmento normal", () => {
    expect(segmentarPorReferencias("solo texto")).toEqual([{ texto: "solo texto", esReferencia: false }]);
  });

  it("no marca el `@` de un email", () => {
    const segmentos = segmentarPorReferencias("escribile a juan@plantilla:x");
    expect(segmentos.every((s) => !s.esReferencia)).toBe(true);
  });
});
