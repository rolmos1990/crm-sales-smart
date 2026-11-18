// 041 — Paginación por tramos para el orden por prioridad (research D2). Puro:
// con los conteos de cada tramo y la ventana pedida, dice qué rebanada leer
// de cada uno, en orden. Así el orden por prioridad no necesita SQL crudo.
import type { Tramo } from "./condiciones";

export interface RebanadaTramo {
  tramo: Tramo;
  skip: number;
  take: number;
}

export function planificarTramos(conteos: Record<Tramo, number>, skip: number, take: number): RebanadaTramo[] {
  const plan: RebanadaTramo[] = [];
  let inicioTramo = 0;
  let restante = take;
  for (const tramo of [1, 2, 3, 4] as const) {
    const finTramo = inicioTramo + conteos[tramo];
    if (restante > 0 && skip < finTramo) {
      const desde = Math.max(skip - inicioTramo, 0);
      const cuantos = Math.min(conteos[tramo] - desde, restante);
      if (cuantos > 0) {
        plan.push({ tramo, skip: desde, take: cuantos });
        restante -= cuantos;
      }
    }
    inicioTramo = finTramo;
  }
  return plan;
}
