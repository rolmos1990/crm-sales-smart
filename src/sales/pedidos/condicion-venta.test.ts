import { describe, expect, it } from "vitest";

import {
  construirCondicionAbiertos,
  construirCondicionVenta,
  type EtapaParaKpis,
} from "./condicion-venta";

// 038-cuenta-como-venta — la población de "Total ventas" se deriva en vivo del
// flag `cuentaComoVenta` de la etapa y nunca se persiste en el Pedido. Estas
// son funciones puras justamente para poder probar esa derivación sin base de
// datos (research.md Decisión 9).

function etapa(id: string, flags: Partial<Omit<EtapaParaKpis, "id">> = {}): EtapaParaKpis {
  return { id, esFinal: false, esCancelacion: false, cuentaComoVenta: false, ...flags };
}

const FLUJO: EtapaParaKpis[] = [
  etapa("nuevo"),
  etapa("proceso"),
  etapa("entregado", { esFinal: true, cuentaComoVenta: true }),
  etapa("cancelado", { esCancelacion: true }),
];

describe("construirCondicionVenta", () => {
  it("con una etapa marcada, filtra solo por esa etapa (FR-006)", () => {
    expect(construirCondicionVenta(FLUJO)).toEqual({
      flujoVentaEtapaId: { in: ["entregado"] },
    });
  });

  it("con dos etapas marcadas de cuatro, incluye ambas y ninguna más (FR-002, FR-006)", () => {
    const conDos = FLUJO.map((e) =>
      e.id === "proceso" ? { ...e, cuentaComoVenta: true } : e,
    );

    expect(construirCondicionVenta(conDos)).toEqual({
      flujoVentaEtapaId: { in: ["proceso", "entregado"] },
    });
  });

  // El caso que una refactorización puede romper sin que nadie lo note: si
  // `in: []` se "simplificara" a `{}`, los totales volverían a sumar TODOS los
  // pedidos — el problema exacto que 038 corrige — y los tests de arriba
  // seguirían pasando.
  it("sin ninguna etapa marcada, no matchea nada y el total queda en 0 (FR-009)", () => {
    const sinMarcar = FLUJO.map((e) => ({ ...e, cuentaComoVenta: false }));
    const condicion = construirCondicionVenta(sinMarcar);

    expect(condicion).toEqual({ flujoVentaEtapaId: { in: [] } });
    expect(condicion).not.toEqual({});
  });

  it("sin flujo dinámico, cae al enum legacy sin cambiar el comportamiento previo (FR-010)", () => {
    expect(construirCondicionVenta([])).toEqual({ estado: "ENTREGADO" });
  });

  it("una etapa final de cancelación nunca cuenta como venta", () => {
    const soloCancelacion = [
      etapa("nuevo"),
      etapa("cancelado", { esCancelacion: true }),
    ];

    expect(construirCondicionVenta(soloCancelacion)).toEqual({
      flujoVentaEtapaId: { in: [] },
    });
  });
});

describe("construirCondicionAbiertos", () => {
  it("excluye las etapas finales y de cancelación (FR-028)", () => {
    expect(construirCondicionAbiertos(FLUJO)).toEqual({
      flujoVentaEtapaId: { notIn: ["entregado", "cancelado"] },
    });
  });

  it("sin etapas de cierre configuradas, todos los pedidos están abiertos", () => {
    expect(construirCondicionAbiertos([etapa("nuevo"), etapa("proceso")])).toEqual({});
  });

  it("sin flujo dinámico, usa el enum legacy", () => {
    expect(construirCondicionAbiertos([])).toEqual({
      estado: { notIn: ["ENTREGADO", "CANCELADO"] },
    });
  });
});
