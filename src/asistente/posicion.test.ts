import { describe, expect, it } from "vitest";
import { MARGEN_BORDE, limitarPosicion, parsearPosicion, superaUmbral } from "./posicion";

const BOTON = { ancho: 80, alto: 80 };
const VENTANA = { ancho: 1280, alto: 720 };

describe("limitarPosicion", () => {
  it("deja intacta una posición dentro de la ventana", () => {
    expect(limitarPosicion({ x: 300, y: 200 }, BOTON, VENTANA)).toEqual({ x: 300, y: 200 });
  });

  it("no deja que el botón salga por ningún borde", () => {
    expect(limitarPosicion({ x: -50, y: -50 }, BOTON, VENTANA)).toEqual({ x: MARGEN_BORDE, y: MARGEN_BORDE });
    expect(limitarPosicion({ x: 5000, y: 5000 }, BOTON, VENTANA)).toEqual({
      x: VENTANA.ancho - BOTON.ancho - MARGEN_BORDE,
      y: VENTANA.alto - BOTON.alto - MARGEN_BORDE,
    });
  });

  it("reubica una posición guardada cuando la ventana se achica", () => {
    const enEscritorio = { x: 1150, y: 600 };
    const movil = { ancho: 375, alto: 667 };
    expect(limitarPosicion(enEscritorio, BOTON, movil)).toEqual({
      x: 375 - 80 - MARGEN_BORDE,
      y: 667 - 80 - MARGEN_BORDE,
    });
  });
});

describe("superaUmbral", () => {
  it("distingue un clic de un arrastre", () => {
    expect(superaUmbral({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
    expect(superaUmbral({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(true);
  });
});

describe("parsearPosicion", () => {
  it("acepta una posición válida", () => {
    expect(parsearPosicion('{"x":10,"y":20}')).toEqual({ x: 10, y: 20 });
  });

  it("descarta valores ausentes, corruptos o incompletos", () => {
    expect(parsearPosicion(null)).toBeNull();
    expect(parsearPosicion("no-json")).toBeNull();
    expect(parsearPosicion('{"x":"a","y":2}')).toBeNull();
    expect(parsearPosicion('{"x":1}')).toBeNull();
  });
});
