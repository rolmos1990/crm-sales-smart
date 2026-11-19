// 042 — Política de planificación (research D2). Pura: sin Prisma, para
// probar la justicia con miles de cuentas simuladas. El SQL que la aplica
// sobre la base está en cola.ts (`tomarTurnoCuenta`).
//
// Stride scheduling: cada cuenta tiene `siguienteTurnoEn`; atiende la que
// tiene el valor más chico y lo avanza `intervaloBase / peso`. Con lotes de
// tamaño parecido es Weighted Fair Queuing: a igual peso, nadie recibe un
// segundo turno antes de que todos reciban el primero; a peso 2, el doble.
// El `max(actual, ahora)` evita que una cuenta que estuvo quieta acumule
// crédito y monopolice al volver.
import type { PrioridadAnalisis } from "@/generated/prisma/enums";

export const PRIORIDADES: readonly PrioridadAnalisis[] = ["P0", "P1", "P2"];
export const INTERVALO_BASE_MS = 1000;

export type PorClase<T> = Record<PrioridadAnalisis, T>;

export function siguienteTurno(actual: Date, ahora: Date, peso: number, intervaloBaseMs: number = INTERVALO_BASE_MS): Date {
  const desde = Math.max(actual.getTime(), ahora.getTime());
  return new Date(desde + intervaloBaseMs / Math.max(1, peso));
}

/**
 * Reparte la capacidad total entre P0/P1/P2 según los cupos (porcentajes), y
 * devuelve qué clase atiende cada espacio LIBRE, en orden.
 *
 * - Cuotas por resto mayor: con 3 espacios y 20/50/30, uno para cada clase.
 * - P0 con demanda siempre tiene al menos un espacio.
 * - Una clase sin demanda presta sus espacios (FR-029): primero a P0, luego
 *   a P1, luego a P2.
 */
export function repartirEspacios(
  capacidad: number,
  enCurso: PorClase<number>,
  cupos: PorClase<number>,
  demanda: PorClase<boolean>,
): PrioridadAnalisis[] {
  if (capacidad <= 0) return [];
  const cuota = PRIORIDADES.map((p) => (capacidad * cupos[p]) / 100);
  const asignado = cuota.map(Math.floor);
  let resto = capacidad - asignado.reduce((a, b) => a + b, 0);
  const porFraccion = PRIORIDADES.map((_, i) => i).sort((a, b) => cuota[b] - asignado[b] - (cuota[a] - asignado[a]) || a - b);
  for (const i of porFraccion) {
    if (resto <= 0) break;
    asignado[i]++;
    resto--;
  }
  const objetivo: PorClase<number> = { P0: asignado[0], P1: asignado[1], P2: asignado[2] };

  if (demanda.P0 && objetivo.P0 === 0) {
    const donante = objetivo.P2 > 0 ? "P2" : "P1";
    objetivo[donante]--;
    objetivo.P0++;
  }

  // Préstamo: lo que una clase sin demanda no usa pasa a las que sí tienen.
  let prestado = 0;
  for (const p of PRIORIDADES) {
    if (!demanda[p]) {
      prestado += objetivo[p];
      objetivo[p] = 0;
    }
  }
  for (const p of PRIORIDADES) {
    if (prestado > 0 && demanda[p]) {
      objetivo[p] += prestado;
      prestado = 0;
    }
  }

  const libres: PrioridadAnalisis[] = [];
  for (const p of PRIORIDADES) {
    for (let i = enCurso[p]; i < objetivo[p]; i++) libres.push(p);
  }
  // Si hay más espacios libres que objetivo (otra clase ocupa de más mientras
  // presta), el sobrante va a la clase con demanda de mayor prioridad.
  const totalEnCurso = enCurso.P0 + enCurso.P1 + enCurso.P2;
  const sobrante = capacidad - totalEnCurso - libres.length;
  const primeraConDemanda = PRIORIDADES.find((p) => demanda[p]);
  if (sobrante > 0 && primeraConDemanda) for (let i = 0; i < sobrante; i++) libres.push(primeraConDemanda);
  return libres.slice(0, Math.max(0, capacidad - totalEnCurso));
}

// ── Simulación (pruebas y simulador de carga) ───────────────────────────────

export interface CuentaSimulada {
  id: string;
  peso: number;
  siguienteTurnoEn: Date;
  pendientes: PorClase<number>;
  lotesEnCurso: number;
  maxLotesSimultaneos: number;
  historicoPausado: boolean;
}

/** La cuenta que recibe el próximo turno de una prioridad, o null. Misma regla que `tomarTurnoCuenta`. */
export function elegirCuenta(
  cuentas: CuentaSimulada[],
  prioridad: PrioridadAnalisis,
  historicoPausadoGlobal: boolean,
): CuentaSimulada | null {
  let mejor: CuentaSimulada | null = null;
  for (const c of cuentas) {
    if (c.pendientes[prioridad] <= 0 || c.lotesEnCurso >= c.maxLotesSimultaneos) continue;
    if (prioridad === "P2" && (historicoPausadoGlobal || c.historicoPausado)) continue;
    if (!mejor || c.siguienteTurnoEn.getTime() < mejor.siguienteTurnoEn.getTime()) mejor = c;
  }
  return mejor;
}

/**
 * Simula `turnos` asignaciones secuenciales (cada lote termina antes del
 * siguiente) y devuelve el orden en que se atendieron las cuentas.
 */
export function simularTurnos(p: {
  cuentas: CuentaSimulada[];
  prioridad: PrioridadAnalisis;
  turnos: number;
  tamanoLote: number;
  inicio: Date;
  pasoMs?: number;
  historicoPausadoGlobal?: boolean;
}): string[] {
  const orden: string[] = [];
  let ahora = p.inicio.getTime();
  for (let t = 0; t < p.turnos; t++) {
    const c = elegirCuenta(p.cuentas, p.prioridad, p.historicoPausadoGlobal ?? false);
    if (!c) break;
    orden.push(c.id);
    c.pendientes[p.prioridad] = Math.max(0, c.pendientes[p.prioridad] - p.tamanoLote);
    c.siguienteTurnoEn = siguienteTurno(c.siguienteTurnoEn, new Date(ahora), c.peso);
    ahora += p.pasoMs ?? 0;
  }
  return orden;
}
