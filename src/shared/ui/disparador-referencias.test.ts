import { describe, expect, it } from "vitest";
import { consultaActiva } from "./disparador-referencias";

const en = (texto: string) => consultaActiva(texto, texto.length);

describe("consultaActiva", () => {
  it("abre el menú con el `@` recién escrito", () => {
    expect(en("respondé con @")).toEqual({ consulta: "", inicio: 13 });
  });

  it("filtra con lo que se escribió después del `@`", () => {
    expect(en("respondé con @metod")?.consulta).toBe("metod");
  });

  it("sigue abierto con un token a medio escribir", () => {
    expect(en("@plantilla:metod")?.consulta).toBe("plantilla:metod");
  });

  it("no se abre dentro de un email", () => {
    expect(en("escribile a juan@")).toBeNull();
    expect(en("escribile a juan@empresa")).toBeNull();
  });

  it("no se abre con `@@`", () => {
    expect(en("@@")).toBeNull();
  });

  it("se cierra al escribir un espacio", () => {
    expect(en("@plantilla envios")).toBeNull();
  });

  it("se cierra al pasar a la línea siguiente", () => {
    expect(en("@plantilla\nsiguiente")).toBeNull();
  });

  it("sin ningún `@` no hay disparador", () => {
    expect(en("instrucciones normales")).toBeNull();
  });

  it("toma el `@` más cercano al cursor, no el primero del texto", () => {
    expect(en("usá @plantilla:a y también @plan")).toEqual({ consulta: "plan", inicio: 27 });
  });

  it("se abre después de un salto de línea o de un paréntesis", () => {
    expect(en("primera línea\n@")?.inicio).toBe(14);
    expect(en("(@")?.consulta).toBe("");
  });

  it("ignora lo que haya después del cursor", () => {
    const texto = "usá @plan y el resto de la frase";
    expect(consultaActiva(texto, 9)).toEqual({ consulta: "plan", inicio: 4 });
  });
});
