import { describe, expect, it } from "vitest";

import { construirCondicionAbiertos, type EtapaParaKpis } from "./condicion-venta";
import { rangoHoy } from "@/shared/fechas/rangos";

// 038 — "Pendientes" y "Expirados" colgaban de `Pedido.fechaExpiracion`, que
// esta feature elimina. Pasan a calcularse contra la entrega estimada
// (`fechaEntrega`), con el corte en el INICIO del día de negocio.
//
// Por qué el inicio del día y no `ahora`: `fechaEntrega` es una fecha de
// calendario. Con un corte por instante, un pedido con entrega HOY pasaría a
// "expirado" a la medianoche UTC — que en Lima (UTC-5) son las 19:00 del día
// ANTERIOR. El pedido aparecería atrasado antes de que el día empiece.

const ZONA = "America/Lima";
/** Un momento cualquiera del 18-nov-2026 en hora de Lima (13:00 local). */
const AHORA = new Date("2026-11-18T18:00:00.000Z");

const ETAPAS: EtapaParaKpis[] = [
  { id: "nuevo", esFinal: false, esCancelacion: false, cuentaComoVenta: false },
  { id: "entregado", esFinal: true, esCancelacion: false, cuentaComoVenta: true },
  { id: "cancelado", esFinal: false, esCancelacion: true, cuentaComoVenta: false },
];

const inicioDiaHoy = rangoHoy(ZONA, AHORA).desde;

/** Replica la clasificación que hace obtenerPedidosKpis sobre `fechaEntrega`. */
function clasificar(fechaEntrega: Date | null): "pendiente" | "expirado" | "ninguna" {
  if (!fechaEntrega) return "ninguna";
  return fechaEntrega >= inicioDiaHoy ? "pendiente" : "expirado";
}

describe("corte de día para Pendientes/Expirados", () => {
  it("el corte es la medianoche local, no la medianoche UTC", () => {
    // 18-nov 00:00 en Lima = 18-nov 05:00 UTC.
    expect(inicioDiaHoy.toISOString()).toBe("2026-11-18T05:00:00.000Z");
  });

  it("entrega de ayer → Expirados (FR-027)", () => {
    expect(clasificar(new Date("2026-11-17T15:00:00.000Z"))).toBe("expirado");
  });

  it("entrega de mañana → Pendientes (FR-026)", () => {
    expect(clasificar(new Date("2026-11-19T15:00:00.000Z"))).toBe("pendiente");
  });

  it("entrega HOY cuenta como pendiente durante todo el día local (FR-026)", () => {
    // Las tres marcas caen dentro del 18-nov en Lima: 00:00, mediodía y 23:59.
    const inicioDelDia = new Date("2026-11-18T05:00:00.000Z");
    const medioDia = new Date("2026-11-18T17:00:00.000Z");
    const finDelDia = new Date("2026-11-19T04:59:00.000Z");

    expect(clasificar(inicioDelDia)).toBe("pendiente");
    expect(clasificar(medioDia)).toBe("pendiente");
    expect(clasificar(finDelDia)).toBe("pendiente");
  });

  // El bug que el corte por instante habría dejado pasar: con `ahora` como
  // corte, un pedido entregable hoy más temprano ya figuraría como atrasado.
  it("una entrega de hoy por la mañana NO figura como atrasada a la tarde", () => {
    const estaManana = new Date("2026-11-18T13:00:00.000Z"); // 08:00 en Lima

    expect(estaManana < AHORA).toBe(true);        // ya pasó respecto de "ahora"
    expect(clasificar(estaManana)).toBe("pendiente"); // y aun así es pendiente
  });

  it("sin fecha de entrega no entra en ninguna de las dos tarjetas (FR-029)", () => {
    expect(clasificar(null)).toBe("ninguna");
  });
});

describe("población de Pendientes/Expirados", () => {
  it("excluye los pedidos cerrados: finales y de cancelación (FR-028)", () => {
    expect(construirCondicionAbiertos(ETAPAS)).toEqual({
      flujoVentaEtapaId: { notIn: ["entregado", "cancelado"] },
    });
  });

  it("sin flujo dinámico excluye ENTREGADO y CANCELADO del enum legacy", () => {
    expect(construirCondicionAbiertos([])).toEqual({
      estado: { notIn: ["ENTREGADO", "CANCELADO"] },
    });
  });
});
