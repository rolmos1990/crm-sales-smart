"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const OPCIONES_INTERVALO_REFRESH = [
  { valor: 20, etiqueta: "20s" },
  { valor: 30, etiqueta: "30s" },
  { valor: 60, etiqueta: "1 min" },
  { valor: 300, etiqueta: "5 min" },
] as const;

export type IntervaloRefresh = (typeof OPCIONES_INTERVALO_REFRESH)[number]["valor"];

const INTERVALO_DEFAULT: IntervaloRefresh = 30;

function leerIntervaloGuardado(storageKey: string): IntervaloRefresh {
  if (typeof window === "undefined") return INTERVALO_DEFAULT;
  const guardado = Number(window.localStorage.getItem(storageKey));
  const valido = OPCIONES_INTERVALO_REFRESH.some((o) => o.valor === guardado);
  return valido ? (guardado as IntervaloRefresh) : INTERVALO_DEFAULT;
}

/**
 * Auto-refresh con cuenta regresiva visible y configurable por el usuario
 * (persistida en localStorage bajo `storageKey`, para no repetir la elección
 * en cada pantalla). Pausa sola cuando la pestaña no está visible, para no
 * gastar requests de fondo sin que nadie esté mirando.
 *
 * `onTick` se dispara cada vez que el contador llega a 0 — quien use el hook
 * decide qué significa "refrescar" (router.refresh(), un fetch de lista, etc.).
 */
export function useAutoRefresh(storageKey: string, onTick: () => void) {
  const [intervaloSegundos, setIntervaloSegundosState] = useState<IntervaloRefresh>(INTERVALO_DEFAULT);
  const [restante, setRestante] = useState<number>(INTERVALO_DEFAULT);
  const [activo, setActivo] = useState(true);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // Leer preferencia guardada solo en cliente (evita mismatch de hidratación SSR)
  useEffect(() => {
    setIntervaloSegundosState(leerIntervaloGuardado(storageKey));
  }, [storageKey]);

  useEffect(() => {
    setRestante(intervaloSegundos);
  }, [intervaloSegundos]);

  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return; // pestaña en segundo plano
      setRestante((prev) => {
        if (prev <= 1) {
          onTickRef.current();
          return intervaloSegundos;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activo, intervaloSegundos]);

  const cambiarIntervalo = useCallback(
    (segundos: IntervaloRefresh) => {
      setIntervaloSegundosState(segundos);
      setRestante(segundos);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, String(segundos));
      }
    },
    [storageKey]
  );

  return { intervaloSegundos, restante, activo, setActivo, cambiarIntervalo };
}
