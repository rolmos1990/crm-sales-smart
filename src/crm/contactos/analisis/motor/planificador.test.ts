import { describe, expect, it } from "vitest";

import { elegirCuenta, repartirEspacios, siguienteTurno, simularTurnos, type CuentaSimulada } from "./planificador";

// 042 — Justicia entre cuentas (Historia 4, SC-007, SC-008) y cupos por
// prioridad (FR-029, FR-030), con miles de cuentas simuladas.

const T0 = new Date("2026-11-19T15:00:00Z");

function cuenta(id: string, pendientes: Partial<CuentaSimulada["pendientes"]>, extra: Partial<CuentaSimulada> = {}): CuentaSimulada {
  return {
    id,
    peso: 1,
    siguienteTurnoEn: new Date(T0.getTime() - Math.floor(Math.random() * 1000)),
    pendientes: { P0: 0, P1: 0, P2: 0, ...pendientes },
    lotesEnCurso: 0,
    maxLotesSimultaneos: 1,
    historicoPausado: false,
    ...extra,
  };
}

describe("stride scheduling", () => {
  it("con 1.000 cuentas, todas reciben su primer turno antes de que alguna reciba el segundo (SC-007)", () => {
    const cuentas = Array.from({ length: 1000 }, (_, i) => cuenta(`c${i}`, { P2: 10_000 }));
    const orden = simularTurnos({ cuentas, prioridad: "P2", turnos: 1500, tamanoLote: 20, inicio: T0, pasoMs: 5 });
    const primeros = orden.slice(0, 1000);
    expect(new Set(primeros).size).toBe(1000);
  });

  it("una cuenta con 20 pendientes termina en su primer turno aunque otra tenga 10.000 (SC-008)", () => {
    const grande = cuenta("grande", { P1: 10_000 }, { siguienteTurnoEn: new Date(T0.getTime() - 5000) });
    const chica = cuenta("chica", { P1: 20 });
    const orden = simularTurnos({ cuentas: [grande, chica], prioridad: "P1", turnos: 10, tamanoLote: 20, inicio: T0 });
    expect(orden.slice(0, 2).sort()).toEqual(["chica", "grande"]);
    expect(chica.pendientes.P1).toBe(0);
    expect(orden.filter((x) => x === "chica")).toHaveLength(1);
  });

  it("tres cuentas iguales alternan sus lotes (Historia 4, escenario 1)", () => {
    const cuentas = ["A", "B", "C"].map((id, i) => cuenta(id, { P2: 10_000 }, { siguienteTurnoEn: new Date(T0.getTime() - (3 - i)) }));
    const orden = simularTurnos({ cuentas, prioridad: "P2", turnos: 9, tamanoLote: 20, inicio: T0 });
    expect(orden).toEqual(["A", "B", "C", "A", "B", "C", "A", "B", "C"]);
  });

  it("peso 2 contra 1 en 300 lotes da proporción 2:1 (±10 %)", () => {
    const doble = cuenta("doble", { P1: 1_000_000 }, { peso: 2 });
    const simple = cuenta("simple", { P1: 1_000_000 });
    const orden = simularTurnos({ cuentas: [doble, simple], prioridad: "P1", turnos: 300, tamanoLote: 20, inicio: T0 });
    const razon = orden.filter((x) => x === "doble").length / orden.filter((x) => x === "simple").length;
    expect(razon).toBeGreaterThan(1.8);
    expect(razon).toBeLessThan(2.2);
  });

  it("una cuenta en su máximo de lotes simultáneos se saltea", () => {
    const ocupada = cuenta("ocupada", { P1: 100 }, { lotesEnCurso: 1, siguienteTurnoEn: new Date(0) });
    const libre = cuenta("libre", { P1: 100 });
    expect(elegirCuenta([ocupada, libre], "P1", false)?.id).toBe("libre");
  });

  it("una cuenta sin trabajo no recibe turno (FR-027)", () => {
    expect(elegirCuenta([cuenta("vacia", {}), cuenta("con", { P1: 5 })], "P1", false)?.id).toBe("con");
    expect(elegirCuenta([cuenta("vacia", {})], "P1", false)).toBeNull();
  });

  it("la pausa del histórico, global o por cuenta, solo afecta a P2 (FR-030)", () => {
    const c = cuenta("c", { P1: 5, P2: 5 }, { historicoPausado: true });
    expect(elegirCuenta([c], "P2", false)).toBeNull();
    expect(elegirCuenta([c], "P1", false)?.id).toBe("c");
    const d = cuenta("d", { P2: 5 });
    expect(elegirCuenta([d], "P2", true)).toBeNull();
  });

  it("una cuenta que estuvo quieta no acumula crédito: recibe un turno y después alterna", () => {
    const activa = cuenta("activa", { P1: 10_000 }, { siguienteTurnoEn: new Date(T0.getTime() + 50_000) });
    const vuelve = cuenta("vuelve", { P1: 10_000 }, { siguienteTurnoEn: new Date(T0.getTime() - 86_400_000) });
    const orden = simularTurnos({ cuentas: [activa, vuelve], prioridad: "P1", turnos: 6, tamanoLote: 20, inicio: new Date(T0.getTime() + 50_000) });
    expect(orden.slice(0, 4).filter((x) => x === "vuelve").length).toBeLessThanOrEqual(2);
  });

  it("siguienteTurno parte de ahora si el valor quedó en el pasado", () => {
    const pasado = new Date(T0.getTime() - 60_000);
    expect(siguienteTurno(pasado, T0, 1, 1000).getTime()).toBe(T0.getTime() + 1000);
    expect(siguienteTurno(pasado, T0, 4, 1000).getTime()).toBe(T0.getTime() + 250);
  });
});

describe("repartirEspacios (cupos 20/50/30 con préstamo)", () => {
  const cupos = { P0: 20, P1: 50, P2: 30 };
  const cero = { P0: 0, P1: 0, P2: 0 };
  const todas = { P0: true, P1: true, P2: true };

  it("con 10 espacios y demanda en todas: 2/5/3", () => {
    const r = repartirEspacios(10, cero, cupos, todas);
    expect(r.filter((p) => p === "P0")).toHaveLength(2);
    expect(r.filter((p) => p === "P1")).toHaveLength(5);
    expect(r.filter((p) => p === "P2")).toHaveLength(3);
  });

  it("con 3 espacios, uno por clase", () => {
    expect(repartirEspacios(3, cero, cupos, todas).sort()).toEqual(["P0", "P1", "P2"]);
  });

  it("sin P0 ni P1, el histórico usa toda la capacidad (Historia 4, escenario 6)", () => {
    expect(repartirEspacios(10, cero, cupos, { P0: false, P1: false, P2: true })).toEqual(Array(10).fill("P2"));
  });

  it("cuando aparece P0, recupera su espacio en la vuelta siguiente", () => {
    const r = repartirEspacios(10, { P0: 0, P1: 0, P2: 9 }, cupos, todas);
    expect(r[0]).toBe("P0");
  });

  it("P0 con demanda siempre tiene al menos un espacio, aunque la capacidad sea 1", () => {
    expect(repartirEspacios(1, cero, cupos, todas)).toEqual(["P0"]);
  });

  it("nunca devuelve más espacios que los libres", () => {
    expect(repartirEspacios(3, { P0: 1, P1: 1, P2: 1 }, cupos, todas)).toEqual([]);
    expect(repartirEspacios(3, { P0: 0, P1: 2, P2: 0 }, cupos, todas)).toHaveLength(1);
  });
});
