"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { KariaEmotion, KariaState } from "@/asistente/karia/animacion";

type ContextoAsistenteKaria = {
  state: KariaState;
  emotion: KariaEmotion;
  /** Se incrementa en cada `celebrar()` para reiniciar el rebote aunque ya esté en `success`. */
  reinicio: number;
  pensar: () => void;
  celebrar: () => void;
  reposar: () => void;
};

// Si `onSuccessEnd` nunca llega (pestaña oculta, avatar desmontado), el
// flotante no puede quedar trabado en `success`.
const SALVAGUARDA_EXITO_MS = 2000;

const Contexto = createContext<ContextoAsistenteKaria | null>(null);

const SIN_PROVIDER: ContextoAsistenteKaria = {
  state: "idle",
  emotion: "neutral",
  reinicio: 0,
  pensar: () => {},
  celebrar: () => {},
  reposar: () => {},
};

export function AsistenteKariaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<KariaState>("idle");
  const [reinicio, setReinicio] = useState(0);

  const pensar = useCallback(() => setState("thinking"), []);
  const reposar = useCallback(() => setState("idle"), []);
  const celebrar = useCallback(() => {
    setState("success");
    setReinicio((n) => n + 1);
  }, []);

  useEffect(() => {
    if (state !== "success") return;
    const t = window.setTimeout(() => setState("idle"), SALVAGUARDA_EXITO_MS);
    return () => window.clearTimeout(t);
  }, [state, reinicio]);

  const valor = useMemo<ContextoAsistenteKaria>(
    () => ({ state, emotion: "neutral", reinicio, pensar, celebrar, reposar }),
    [state, reinicio, pensar, celebrar, reposar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * Controla al asistente flotante desde cualquier pantalla autenticada:
 * `pensar()` mientras se procesa algo, `celebrar()` al completarlo.
 * Otras instancias de `<KariaAvatar>` se controlan por props, no por acá.
 */
export function usarAsistenteKaria(): ContextoAsistenteKaria {
  const valor = useContext(Contexto);
  if (valor) return valor;
  if (process.env.NODE_ENV !== "production") {
    throw new Error("usarAsistenteKaria() debe usarse dentro de <AsistenteKariaProvider>.");
  }
  // En producción una pantalla no se rompe porque el flotante no esté montado.
  return SIN_PROVIDER;
}
