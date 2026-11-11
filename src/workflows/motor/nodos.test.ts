import { describe, expect, it } from "vitest";
import { elegirOpcion } from "./nodos";

const opciones = [
  { id: "a", etiqueta: "Consultar productos", sinonimos: ["catálogo", "productos"] },
  { id: "b", etiqueta: "Consultar un pedido", sinonimos: [] },
  { id: "c", etiqueta: "Hablar con un asesor", sinonimos: ["asesor", "humano"] },
];

describe("elegirOpcion — respuesta al nodo Menú", () => {
  it("acepta el número de la opción", () => {
    expect(elegirOpcion("2", opciones)?.id).toBe("b");
    expect(elegirOpcion(" 3 ", opciones)?.id).toBe("c");
  });

  it("acepta el texto exacto sin importar mayúsculas, tildes ni puntuación", () => {
    expect(elegirOpcion("consultar UN pedido!", opciones)?.id).toBe("b");
  });

  it("acepta sinónimos", () => {
    expect(elegirOpcion("Catalogo", opciones)?.id).toBe("a");
    expect(elegirOpcion("humano", opciones)?.id).toBe("c");
  });

  it("rechaza números fuera de rango y texto que no coincide", () => {
    expect(elegirOpcion("4", opciones)).toBeNull();
    expect(elegirOpcion("0", opciones)).toBeNull();
    expect(elegirOpcion("quiero 2 cosas", opciones)).toBeNull();
  });
});
