"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  PASO_TECLADO_PX,
  limitarPosicion,
  parsearPosicion,
  superaUmbral,
  type Posicion,
} from "@/asistente/posicion";

// Preferencia de este navegador, no del usuario en la base: cada pantalla
// (laptop, monitor, móvil) estorba en un lugar distinto.
const CLAVE_ALMACENAMIENTO = "karia:asistente:posicion";

type Gesto = { puntero: Posicion; boton: Posicion; movido: boolean };

function leerGuardada() {
  try {
    return parsearPosicion(window.localStorage.getItem(CLAVE_ALMACENAMIENTO));
  } catch {
    return null;
  }
}

function guardar(posicion: Posicion | null) {
  try {
    if (posicion) window.localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(posicion));
    else window.localStorage.removeItem(CLAVE_ALMACENAMIENTO);
  } catch {
    // Almacenamiento bloqueado (ventana privada): la posición dura la sesión.
  }
}

const ventana = () => ({ ancho: window.innerWidth, alto: window.innerHeight });

/**
 * Hace arrastrable al botón flotante. `posicion === null` significa "esquina
 * por defecto" (la definen las clases CSS); al moverlo pasa a coordenadas
 * absolutas `left/top`. Un gesto que no supera el umbral sigue siendo un clic.
 */
export function usarArrastreFlotante() {
  const botonRef = useRef<HTMLButtonElement | null>(null);
  const gestoRef = useRef<Gesto | null>(null);
  const posicionRef = useRef<Posicion | null>(null);
  const clicSuprimidoRef = useRef(false);
  const [posicion, setPosicionEstado] = useState<Posicion | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const tamanoBoton = useCallback(() => {
    const rect = botonRef.current?.getBoundingClientRect();
    return { ancho: rect?.width ?? 0, alto: rect?.height ?? 0 };
  }, []);

  const setPosicion = useCallback((p: Posicion | null) => {
    posicionRef.current = p;
    setPosicionEstado(p);
  }, []);

  useEffect(() => {
    const guardada = leerGuardada();
    if (guardada) setPosicion(limitarPosicion(guardada, tamanoBoton(), ventana()));

    // Al achicar la ventana (o rotar el móvil) el botón no puede quedar fuera.
    const alRedimensionar = () => {
      if (posicionRef.current) setPosicion(limitarPosicion(posicionRef.current, tamanoBoton(), ventana()));
    };
    window.addEventListener("resize", alRedimensionar);
    return () => window.removeEventListener("resize", alRedimensionar);
  }, [setPosicion, tamanoBoton]);

  const onPointerDown = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    gestoRef.current = {
      puntero: { x: e.clientX, y: e.clientY },
      boton: { x: rect.left, y: rect.top },
      movido: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      const gesto = gestoRef.current;
      if (!gesto) return;
      const actual = { x: e.clientX, y: e.clientY };
      if (!gesto.movido) {
        if (!superaUmbral(gesto.puntero, actual)) return;
        gesto.movido = true;
        setArrastrando(true);
      }
      setPosicion(
        limitarPosicion(
          { x: gesto.boton.x + actual.x - gesto.puntero.x, y: gesto.boton.y + actual.y - gesto.puntero.y },
          tamanoBoton(),
          ventana(),
        ),
      );
    },
    [setPosicion, tamanoBoton],
  );

  const terminarGesto = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    const gesto = gestoRef.current;
    gestoRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!gesto?.movido) return;
    setArrastrando(false);
    guardar(posicionRef.current);
    // El navegador dispara `click` justo después de soltar: ese no debe abrir
    // el saludo. Se libera en la siguiente vuelta del event loop por si el
    // `click` no llega (p. ej. se soltó fuera de la ventana).
    clicSuprimidoRef.current = true;
    window.setTimeout(() => {
      clicSuprimidoRef.current = false;
    }, 0);
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Home") {
        e.preventDefault();
        setPosicion(null);
        guardar(null);
        return;
      }
      const paso = e.shiftKey ? PASO_TECLADO_PX * 4 : PASO_TECLADO_PX;
      const delta: Record<string, Posicion> = {
        ArrowLeft: { x: -paso, y: 0 },
        ArrowRight: { x: paso, y: 0 },
        ArrowUp: { x: 0, y: -paso },
        ArrowDown: { x: 0, y: paso },
      };
      const d = delta[e.key];
      if (!d) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const base = posicionRef.current ?? { x: rect.left, y: rect.top };
      const nueva = limitarPosicion({ x: base.x + d.x, y: base.y + d.y }, tamanoBoton(), ventana());
      setPosicion(nueva);
      guardar(nueva);
    },
    [setPosicion, tamanoBoton],
  );

  /** `true` si el clic que está por procesarse viene de soltar un arrastre. */
  const esClicDeArrastre = useCallback(() => clicSuprimidoRef.current, []);

  return {
    botonRef,
    posicion,
    arrastrando,
    esClicDeArrastre,
    manejadores: {
      onPointerDown,
      onPointerMove,
      onPointerUp: terminarGesto,
      onPointerCancel: terminarGesto,
      onKeyDown,
    },
  };
}
