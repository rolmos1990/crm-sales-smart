"use client";

import { useSyncExternalStore } from "react";

/**
 * Hook mínimo y SSR-safe para leer un media query — sin dependencias
 * nuevas. `useSyncExternalStore` es lo que evita el error de hidratación:
 * en el render de servidor (y en el primer render del cliente, antes de
 * montar) usa `getServerSnapshot` (siempre `false`), así que el HTML
 * coincide; recién después de montado vuelve a evaluar `matchMedia` y
 * corrige si hace falta — un solo re-render, sin parpadeo del árbol
 * incorrecto (ver `PipelineKanbanDinamico`, que además espera a estar
 * montado antes de decidir qué árbol completo renderizar).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
