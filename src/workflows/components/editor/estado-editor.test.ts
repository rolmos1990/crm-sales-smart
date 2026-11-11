import { describe, expect, it } from "vitest";
import { definicionInicial } from "../../schema";
import { duplicarNodos, estadoInicial, quitarNodos, reducerEditor } from "./estado-editor";

const moverFin = (y: number) => ({
  tipo: "APLICAR" as const,
  cambio: (d: ReturnType<typeof definicionInicial>) => ({
    ...d,
    nodos: d.nodos.map((n) => (n.id === "fin" ? { ...n, posicion: { x: 0, y } } : n)),
  }),
});

describe("reducerEditor — deshacer / rehacer", () => {
  it("deshace y rehace cambios en orden", () => {
    let e = estadoInicial(definicionInicial());
    e = reducerEditor(e, moverFin(300));
    e = reducerEditor(e, moverFin(400));
    expect(e.definicion.nodos[1].posicion.y).toBe(400);

    e = reducerEditor(e, { tipo: "DESHACER" });
    expect(e.definicion.nodos[1].posicion.y).toBe(300);
    e = reducerEditor(e, { tipo: "DESHACER" });
    expect(e.definicion.nodos[1].posicion.y).toBe(220);
    e = reducerEditor(e, { tipo: "REHACER" });
    expect(e.definicion.nodos[1].posicion.y).toBe(300);
  });

  it("un cambio nuevo descarta lo que se podía rehacer", () => {
    let e = estadoInicial(definicionInicial());
    e = reducerEditor(e, moverFin(300));
    e = reducerEditor(e, { tipo: "DESHACER" });
    e = reducerEditor(e, moverFin(500));
    expect(e.futuro).toHaveLength(0);
  });

  it("arrastrar sin historial y marcar el punto al soltar deja un solo paso para deshacer", () => {
    const inicial = estadoInicial(definicionInicial());
    let e = inicial;
    for (const y of [230, 240, 250]) e = reducerEditor(e, { ...moverFin(y), historial: false });
    e = reducerEditor(e, { tipo: "MARCAR_PUNTO_HISTORIAL", antes: inicial.definicion });
    expect(e.pasado).toHaveLength(1);
    e = reducerEditor(e, { tipo: "DESHACER" });
    expect(e.definicion.nodos[1].posicion.y).toBe(220);
  });

  it("cada edición incrementa la revisión (dispara el autoguardado)", () => {
    let e = estadoInicial(definicionInicial());
    e = reducerEditor(e, moverFin(300));
    e = reducerEditor(e, { tipo: "DESHACER" });
    expect(e.revision).toBe(2);
  });
});

describe("operaciones sobre la definición", () => {
  it("quitar un nodo quita también sus conexiones", () => {
    const d = quitarNodos(definicionInicial(), new Set(["fin"]));
    expect(d.nodos.map((n) => n.id)).toEqual(["inicio"]);
    expect(d.conexiones).toEqual([]);
  });

  it("duplicar copia nodos y conexiones internas con ids nuevos, pero nunca el Inicio", () => {
    const base = definicionInicial();
    const { definicion, nuevosIds } = duplicarNodos(base, { nodos: base.nodos, conexiones: base.conexiones });
    expect(nuevosIds).toHaveLength(1);
    expect(definicion.nodos.filter((n) => n.tipo === "INICIO")).toHaveLength(1);
    expect(definicion.nodos).toHaveLength(3);
    expect(nuevosIds[0]).not.toBe("fin");
  });
});
