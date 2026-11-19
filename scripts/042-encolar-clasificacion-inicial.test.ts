import { describe, expect, it } from "vitest";

import { siguienteCursor, TAMANO_PAGINA } from "./042-encolar-clasificacion-inicial";

// 042 (research D16) — paginación por cursor de la clasificación inicial.

describe("siguienteCursor", () => {
  it("una página completa sigue desde el último id", () => {
    const ids = Array.from({ length: TAMANO_PAGINA }, (_, i) => `c${String(i).padStart(5, "0")}`);
    expect(siguienteCursor(ids)).toBe(ids[ids.length - 1]);
  });

  it("una página incompleta termina", () => {
    expect(siguienteCursor(["a", "b"], 10)).toBeNull();
  });

  it("una página vacía termina", () => {
    expect(siguienteCursor([], 10)).toBeNull();
  });

  it("recorre todo sin repetir ni saltear con páginas exactas", () => {
    const todos = Array.from({ length: 25 }, (_, i) => `c${String(i).padStart(3, "0")}`);
    const vistos: string[] = [];
    let cursor: string | null = "";
    while (cursor !== null) {
      const pagina = todos.filter((id) => id > cursor!).slice(0, 5);
      if (pagina.length === 0) break;
      vistos.push(...pagina);
      cursor = siguienteCursor(pagina, 5);
    }
    expect(vistos).toEqual(todos);
  });
});
