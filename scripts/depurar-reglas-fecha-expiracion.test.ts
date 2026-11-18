import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  CAMPO_ELIMINADO,
  depurarReglas,
  podarCampo,
} from "./depurar-reglas-fecha-expiracion";

// 038 — este script es el único punto donde la feature puede romper algo que
// hoy funciona: si una regla queda apuntando al campo eliminado, el evaluador
// resuelve `undefined` y bloquea el avance de los pedidos sin mostrar error.

const cond = (fieldKey: string) => ({
  type: "condition" as const,
  fieldKey,
  operator: "IGUAL" as never,
  value: "x",
});

const grupo = (hijos: unknown[]) => ({
  type: "group" as const,
  logicalOperator: "AND" as const,
  children: hijos as never[],
});

describe("podarCampo", () => {
  it("quita la condición del campo en el grupo raíz y conserva las hermanas", () => {
    const arbol = grupo([cond("montos.total"), cond(CAMPO_ELIMINADO), cond("general.moneda")]);

    const { arbol: podado, quitados } = podarCampo(arbol);

    expect(quitados).toBe(1);
    expect(podado?.children).toHaveLength(2);
    expect(podado?.children.map((c) => (c as { fieldKey: string }).fieldKey))
      .toEqual(["montos.total", "general.moneda"]);
  });

  it("quita la condición dentro de un grupo de nivel 2", () => {
    const arbol = grupo([
      cond("montos.total"),
      grupo([cond(CAMPO_ELIMINADO), cond("general.fechaEntrega")]),
    ]);

    const { arbol: podado, quitados } = podarCampo(arbol);

    expect(quitados).toBe(1);
    const anidado = podado?.children[1] as { children: { fieldKey: string }[] };
    expect(anidado.children.map((c) => c.fieldKey)).toEqual(["general.fechaEntrega"]);
  });

  // Dejar el grupo vacío violaría ArbolCondicionesSchema, que exige al menos
  // un hijo — la regla quedaría ilegible para el evaluador.
  it("elimina por completo un grupo de nivel 2 que queda sin condiciones", () => {
    const arbol = grupo([cond("montos.total"), grupo([cond(CAMPO_ELIMINADO)])]);

    const { arbol: podado, quitados } = podarCampo(arbol);

    expect(quitados).toBe(1);
    expect(podado?.children).toHaveLength(1);
    expect((podado?.children[0] as { fieldKey: string }).fieldKey).toBe("montos.total");
  });

  it("devuelve null cuando era la única condición: la regla debe ir a BORRADOR", () => {
    const { arbol, quitados } = podarCampo(grupo([cond(CAMPO_ELIMINADO)]));

    expect(quitados).toBe(1);
    expect(arbol).toBeNull();
  });

  it("no toca un árbol que no menciona el campo (idempotencia)", () => {
    const arbol = grupo([cond("montos.total")]);

    const primera = podarCampo(arbol);
    const segunda = podarCampo(primera.arbol);

    expect(primera.quitados).toBe(0);
    expect(segunda.quitados).toBe(0);
    expect(segunda.arbol).toEqual(arbol);
  });

  it("tolera un árbol nulo o malformado sin lanzar", () => {
    expect(podarCampo(null).quitados).toBe(0);
    expect(podarCampo(undefined).arbol).toBeNull();
  });
});

describe("depurarReglas", () => {
  const condicionFindMany = vi.fn();
  const condicionDeleteMany = vi.fn();
  const reglaFindMany = vi.fn();
  const reglaUpdate = vi.fn();

  const prisma = {
    flujoVentaReglaCondicion: { findMany: condicionFindMany, deleteMany: condicionDeleteMany },
    flujoVentaRegla: { findMany: reglaFindMany, update: reglaUpdate },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    condicionFindMany.mockResolvedValue([]);
    reglaFindMany.mockResolvedValue([]);
  });

  function regla(id: string, arbolCondiciones: unknown) {
    return {
      id,
      nombre: `Regla ${id}`,
      arbolCondiciones,
      etapaDestino: { flujoVenta: { instanciaId: "inst-1" } },
    };
  }

  it("borra las condiciones de la tabla legada", async () => {
    condicionFindMany.mockResolvedValue([
      { id: "c-1", reglaId: "r-1", campo: CAMPO_ELIMINADO },
    ]);

    const resumen = await depurarReglas(prisma, {});

    expect(resumen.condicionesLegadas).toBe(1);
    expect(condicionDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["c-1"] } } });
  });

  it("depura el árbol y conserva la regla publicada si le quedan condiciones", async () => {
    reglaFindMany.mockResolvedValue([
      regla("r-1", grupo([cond("montos.total"), cond(CAMPO_ELIMINADO)])),
    ]);

    const resumen = await depurarReglas(prisma, {});

    expect(resumen).toMatchObject({ reglasDepuradas: 1, reglasABorrador: 0 });
    const data = reglaUpdate.mock.calls[0][0].data;
    expect(data.estado).toBeUndefined();
    expect(data.arbolCondiciones.children).toHaveLength(1);
  });

  it("pasa a BORRADOR la regla que queda sin condiciones, sin borrarla", async () => {
    reglaFindMany.mockResolvedValue([regla("r-2", grupo([cond(CAMPO_ELIMINADO)]))]);

    const resumen = await depurarReglas(prisma, {});

    expect(resumen).toMatchObject({ reglasDepuradas: 1, reglasABorrador: 1 });
    expect(reglaUpdate).toHaveBeenCalledWith({
      where: { id: "r-2" },
      data: { arbolCondiciones: null, estado: "BORRADOR" },
    });
  });

  it("ignora las reglas que el filtro trajo pero no mencionan el campo", async () => {
    reglaFindMany.mockResolvedValue([regla("r-3", grupo([cond("montos.total")]))]);

    const resumen = await depurarReglas(prisma, {});

    expect(resumen.reglasDepuradas).toBe(0);
    expect(reglaUpdate).not.toHaveBeenCalled();
  });

  it("con --dry-run informa pero no escribe nada", async () => {
    condicionFindMany.mockResolvedValue([{ id: "c-1", reglaId: "r-1", campo: CAMPO_ELIMINADO }]);
    reglaFindMany.mockResolvedValue([regla("r-2", grupo([cond(CAMPO_ELIMINADO)]))]);

    const resumen = await depurarReglas(prisma, { dryRun: true });

    expect(resumen).toMatchObject({ condicionesLegadas: 1, reglasDepuradas: 1 });
    expect(condicionDeleteMany).not.toHaveBeenCalled();
    expect(reglaUpdate).not.toHaveBeenCalled();
  });
});
