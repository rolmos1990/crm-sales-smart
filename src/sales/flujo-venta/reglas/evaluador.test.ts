import { describe, expect, it } from "vitest";
import { construirArbolDesdeRegla, evaluarArbol } from "./evaluador";
import type { CampoRegla, ConditionNode, GroupNode, HechosPedido } from "./tipos";

const ZONA = "America/Lima";

function campo(
  key: string,
  dataType: CampoRegla["dataType"],
  allowedOperators: CampoRegla["allowedOperators"] = []
): CampoRegla {
  return { key, label: key, category: "Test", dataType, allowedOperators, resolver: (h) => h[key] };
}

const CATALOGO: CampoRegla[] = [
  campo("estadoPago", "LISTA", ["IGUAL", "ESTA_EN"]),
  campo("montoPagado", "MONEDA", ["IGUAL", "MAYOR_QUE", "MENOR_QUE"]),
  campo("total", "MONEDA", ["IGUAL", "MAYOR_QUE"]),
  campo("referencia", "TEXTO", ["ESTA_VACIO", "NO_ESTA_VACIO", "CONTIENE"]),
  campo("comprobante", "ARCHIVO", ["ADJUNTO", "NO_ADJUNTO"]),
  campo("fechaEntrega", "FECHA", ["ES_HOY", "ESTA_VENCIDA", "ANTES_DE", "PROXIMOS_N_DIAS"]),
  campo("esPrioritario", "BOOLEANO", ["ES_VERDADERO", "ES_FALSO"]),
  campo("productos", "COLECCION", ["CONTIENE_ALGUNO", "CANTIDAD_MAYOR", "COLECCION_VACIA"]),
  campo("custom.talla", "TEXTO", ["IGUAL"]),
];

const condicion = (partial: Partial<ConditionNode>): ConditionNode => ({
  type: "condition",
  fieldKey: "",
  operator: "IGUAL",
  value: null,
  ...partial,
});

const grupo = (logicalOperator: "AND" | "OR", children: (ConditionNode | GroupNode)[]): GroupNode => ({
  type: "group",
  logicalOperator,
  children,
});

const AHORA = new Date("2026-08-21T15:00:00Z"); // 21 ago 2026, mediodía en America/Lima (UTC-5)

describe("evaluarArbol", () => {
  it("AND: se cumple solo si todas las condiciones son verdaderas", () => {
    const hechos: HechosPedido = { estadoPago: "PAGADO", montoPagado: 100, total: 100 };
    const arbol = grupo("AND", [
      condicion({ fieldKey: "estadoPago", operator: "IGUAL", value: "PAGADO" }),
      condicion({ fieldKey: "montoPagado", operator: "IGUAL", comparisonFieldKey: "total" }),
    ]);
    expect(evaluarArbol(arbol, hechos, CATALOGO, ZONA, AHORA).cumple).toBe(true);

    const hechosIncompletos = { ...hechos, montoPagado: 50 };
    expect(evaluarArbol(arbol, hechosIncompletos, CATALOGO, ZONA, AHORA).cumple).toBe(false);
  });

  it("OR: se cumple si alguna condición es verdadera", () => {
    const arbol = grupo("OR", [
      condicion({ fieldKey: "referencia", operator: "NO_ESTA_VACIO" }),
      condicion({ fieldKey: "comprobante", operator: "ADJUNTO" }),
    ]);
    expect(evaluarArbol(arbol, { referencia: "", comprobante: "url.pdf" }, CATALOGO, ZONA).cumple).toBe(true);
    expect(evaluarArbol(arbol, { referencia: "", comprobante: null }, CATALOGO, ZONA).cumple).toBe(false);
  });

  it("grupo anidado (2 niveles): AND raíz con un OR adentro", () => {
    const arbol = grupo("AND", [
      condicion({ fieldKey: "estadoPago", operator: "IGUAL", value: "PAGADO" }),
      grupo("OR", [
        condicion({ fieldKey: "referencia", operator: "NO_ESTA_VACIO" }),
        condicion({ fieldKey: "comprobante", operator: "ADJUNTO" }),
      ]),
    ]);
    // Estado de pago ok + ninguno de los dos del OR -> falla
    expect(evaluarArbol(arbol, { estadoPago: "PAGADO", referencia: "", comprobante: null }, CATALOGO, ZONA).cumple).toBe(false);
    // Estado de pago ok + al menos uno del OR -> cumple
    expect(evaluarArbol(arbol, { estadoPago: "PAGADO", referencia: "REF-1", comprobante: null }, CATALOGO, ZONA).cumple).toBe(true);
  });

  it("comparación contra otro campo", () => {
    const arbol = grupo("AND", [condicion({ fieldKey: "montoPagado", operator: "MAYOR_QUE", comparisonFieldKey: "total" })]);
    expect(evaluarArbol(arbol, { montoPagado: 150, total: 100 }, CATALOGO, ZONA).cumple).toBe(true);
    expect(evaluarArbol(arbol, { montoPagado: 50, total: 100 }, CATALOGO, ZONA).cumple).toBe(false);
  });

  it("campo personalizado", () => {
    const arbol = grupo("AND", [condicion({ fieldKey: "custom.talla", operator: "IGUAL", value: "M" })]);
    expect(evaluarArbol(arbol, { "custom.talla": "M" }, CATALOGO, ZONA).cumple).toBe(true);
    expect(evaluarArbol(arbol, { "custom.talla": "L" }, CATALOGO, ZONA).cumple).toBe(false);
  });

  it("regla desactivada/borrador no se modela acá — eso lo filtra el motor central (ver reglas/motor.ts) antes de llegar al evaluador", () => {
    // Documentación viva: evaluarArbol no sabe nada de `activo`/`estado`, así
    // que ese filtrado se prueba en la integración E2E, no acá.
    expect(true).toBe(true);
  });

  it("fechas — respeta zona horaria y 'hoy'", () => {
    const arbolHoy = grupo("AND", [condicion({ fieldKey: "fechaEntrega", operator: "ES_HOY" })]);
    // AHORA es 21 ago 2026 (America/Lima) — misma fecha calendario
    expect(evaluarArbol(arbolHoy, { fechaEntrega: "2026-08-21T09:00:00Z" }, CATALOGO, ZONA, AHORA).cumple).toBe(true);
    expect(evaluarArbol(arbolHoy, { fechaEntrega: "2026-08-20T09:00:00Z" }, CATALOGO, ZONA, AHORA).cumple).toBe(false);

    const arbolVencida = grupo("AND", [condicion({ fieldKey: "fechaEntrega", operator: "ESTA_VENCIDA" })]);
    expect(evaluarArbol(arbolVencida, { fechaEntrega: "2026-08-01" }, CATALOGO, ZONA, AHORA).cumple).toBe(true);
    expect(evaluarArbol(arbolVencida, { fechaEntrega: "2026-09-01" }, CATALOGO, ZONA, AHORA).cumple).toBe(false);

    const arbolProximos = grupo("AND", [condicion({ fieldKey: "fechaEntrega", operator: "PROXIMOS_N_DIAS", value: "5" })]);
    expect(evaluarArbol(arbolProximos, { fechaEntrega: "2026-08-24" }, CATALOGO, ZONA, AHORA).cumple).toBe(true);
    expect(evaluarArbol(arbolProximos, { fechaEntrega: "2026-09-01" }, CATALOGO, ZONA, AHORA).cumple).toBe(false);
  });

  it("igualdad monetaria: redondea a 2 decimales para evitar ruido de punto flotante", () => {
    const arbol = grupo("AND", [condicion({ fieldKey: "montoPagado", operator: "IGUAL", value: "100" })]);
    expect(evaluarArbol(arbol, { montoPagado: 99.999999999 }, CATALOGO, ZONA).cumple).toBe(true);
    expect(evaluarArbol(arbol, { montoPagado: 99.98 }, CATALOGO, ZONA).cumple).toBe(false);
  });

  it("colecciones: contiene alguno / cantidad", () => {
    const arbolAlguno = grupo("AND", [condicion({ fieldKey: "productos", operator: "CONTIENE_ALGUNO", value: ["p1", "p2"] })]);
    expect(evaluarArbol(arbolAlguno, { productos: ["p2", "p3"] }, CATALOGO, ZONA).cumple).toBe(true);
    expect(evaluarArbol(arbolAlguno, { productos: ["p9"] }, CATALOGO, ZONA).cumple).toBe(false);

    const arbolCantidad = grupo("AND", [condicion({ fieldKey: "productos", operator: "CANTIDAD_MAYOR", value: "2" })]);
    expect(evaluarArbol(arbolCantidad, { productos: ["a", "b", "c"] }, CATALOGO, ZONA).cumple).toBe(true);
    expect(evaluarArbol(arbolCantidad, { productos: ["a"] }, CATALOGO, ZONA).cumple).toBe(false);
  });

  it("booleano", () => {
    const arbol = grupo("AND", [condicion({ fieldKey: "esPrioritario", operator: "ES_VERDADERO" })]);
    expect(evaluarArbol(arbol, { esPrioritario: true }, CATALOGO, ZONA).cumple).toBe(true);
    expect(evaluarArbol(arbol, { esPrioritario: false }, CATALOGO, ZONA).cumple).toBe(false);
  });

  it("grupo vacío: AND vacío no bloquea, OR vacío no habilita nada", () => {
    expect(evaluarArbol(grupo("AND", []), {}, CATALOGO, ZONA).cumple).toBe(true);
    expect(evaluarArbol(grupo("OR", []), {}, CATALOGO, ZONA).cumple).toBe(false);
  });

  it("condiciones evaluadas: devuelve el detalle completo, no solo el resultado final", () => {
    const arbol = grupo("AND", [
      condicion({ fieldKey: "estadoPago", operator: "IGUAL", value: "PAGADO" }),
      condicion({ fieldKey: "referencia", operator: "NO_ESTA_VACIO" }),
    ]);
    const resultado = evaluarArbol(arbol, { estadoPago: "PAGADO", referencia: "" }, CATALOGO, ZONA);
    expect(resultado.cumple).toBe(false);
    expect(resultado.condiciones).toHaveLength(2);
    expect(resultado.condiciones[0].cumple).toBe(true);
    expect(resultado.condiciones[1].cumple).toBe(false);
  });
});

describe("construirArbolDesdeRegla", () => {
  it("usa arbolCondiciones cuando está presente", () => {
    const arbol = grupo("OR", [condicion({ fieldKey: "a", operator: "IGUAL", value: "1" })]);
    const resultado = construirArbolDesdeRegla({ arbolCondiciones: arbol, condiciones: [] });
    expect(resultado).toEqual(arbol);
  });

  it("cae a AND plano sobre `condiciones` cuando no hay árbol (reglas creadas antes de este catálogo)", () => {
    const resultado = construirArbolDesdeRegla({
      arbolCondiciones: null,
      condiciones: [
        { campo: "total", operador: "MAYOR_QUE", valor: "0" },
        { campo: "metadata.estadoPago", operador: "IGUAL", valor: "PAGADO" },
      ],
    });
    expect(resultado.type).toBe("group");
    expect(resultado.logicalOperator).toBe("AND");
    expect(resultado.children).toHaveLength(2);
    expect(resultado.children[0]).toMatchObject({ type: "condition", fieldKey: "total", operator: "MAYOR_QUE", value: "0" });
  });
});
