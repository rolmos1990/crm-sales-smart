"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  DURACION_EXITO_MS,
  SECUENCIA_PESTANEO,
  duracionSecuencia,
  frameEn,
  intervaloParpadeo,
  posicionFrame,
  resolverAnimacion,
  type KariaEmotion,
  type KariaState,
} from "./animacion";
import "./karia-avatar.css";

export type KariaAvatarProps = {
  state?: KariaState;
  emotion?: KariaEmotion;
  blinking?: boolean;
  /** Lado en px. El sprite es de 192 px: nítido hasta 96 px. */
  size?: number;
  floating?: boolean;
  /** Se llama una vez al terminar `success` (también con movimiento reducido). */
  onSuccessEnd?: () => void;
  /** Cambiarlo reinicia la animación actual (p. ej. repetir el rebote de `success`). */
  reinicio?: number;
  /** Con `label` es una imagen con nombre accesible; sin él, decorativo. */
  label?: string;
  className?: string;
};

const CONSULTA_MOVIMIENTO_REDUCIDO = "(prefers-reduced-motion: reduce)";

function suscribirMovimientoReducido(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_MOVIMIENTO_REDUCIDO);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

function usarMovimientoReducido() {
  return useSyncExternalStore(
    suscribirMovimientoReducido,
    () => window.matchMedia(CONSULTA_MOVIMIENTO_REDUCIDO).matches,
    () => false,
  );
}

/**
 * Mascota de Karia, controlada por props. Cada instancia tiene su propio
 * secuenciador: los frames se pintan escribiendo `background-position` en el
 * nodo, sin `setState`, así que animar no re-renderiza React.
 */
export function KariaAvatar({
  state = "idle",
  emotion = "neutral",
  blinking = true,
  size = 64,
  floating = true,
  onSuccessEnd,
  reinicio = 0,
  label,
  className,
}: KariaAvatarProps) {
  const spriteRef = useRef<HTMLSpanElement | null>(null);
  const ultimoFrameRef = useRef(-1);
  const onSuccessEndRef = useRef(onSuccessEnd);
  const reducido = usarMovimientoReducido();
  const animacion = resolverAnimacion({ state, emotion });

  useEffect(() => {
    onSuccessEndRef.current = onSuccessEnd;
  }, [onSuccessEnd]);

  // El nodo del sprite se re-monta al cambiar `reinicio` (para reiniciar el
  // rebote CSS); el ref callback repinta el frame actual en el nodo nuevo.
  const asignarSprite = useCallback((nodo: HTMLSpanElement | null) => {
    spriteRef.current = nodo;
    if (nodo && ultimoFrameRef.current >= 0) {
      nodo.style.backgroundPosition = posicionFrame(ultimoFrameRef.current);
    }
  }, []);

  useEffect(() => {
    const { base, admitePestaneo, frameReducido } = resolverAnimacion({ state, emotion });
    // React pudo reescribir el estilo inline en este render: no confiar en el cache.
    ultimoFrameRef.current = -1;

    const pintar = (frame: number) => {
      if (frame === ultimoFrameRef.current) return;
      ultimoFrameRef.current = frame;
      if (spriteRef.current) spriteRef.current.style.backgroundPosition = posicionFrame(frame);
    };

    if (reducido) {
      pintar(frameReducido);
      if (state !== "success") return;
      const t = window.setTimeout(() => onSuccessEndRef.current?.(), DURACION_EXITO_MS);
      return () => window.clearTimeout(t);
    }

    const pestanea = admitePestaneo && blinking;
    const duracionPestaneo = duracionSecuencia(SECUENCIA_PESTANEO);
    const inicio = performance.now();
    let proximoPestaneo = inicio + intervaloParpadeo();
    let inicioPestaneo: number | null = null;
    let exitoAvisado = false;
    let raf = 0;

    const cuadro = (ahora: number) => {
      let frame: number | null = null;

      if (pestanea) {
        if (inicioPestaneo === null && ahora >= proximoPestaneo) inicioPestaneo = ahora;
        if (inicioPestaneo !== null) {
          const transcurrido = ahora - inicioPestaneo;
          if (transcurrido < duracionPestaneo) {
            frame = frameEn(SECUENCIA_PESTANEO, transcurrido);
          } else {
            inicioPestaneo = null;
            proximoPestaneo = ahora + intervaloParpadeo();
          }
        }
      }

      pintar(frame ?? frameEn(base, ahora - inicio));

      if (state === "success" && !exitoAvisado && ahora - inicio >= DURACION_EXITO_MS) {
        exitoAvisado = true;
        onSuccessEndRef.current?.();
      }

      raf = requestAnimationFrame(cuadro);
    };

    // Con la pestaña oculta rAF no corre; al volver se reprograma el próximo
    // pestañeo en vez de dispararlo de inmediato por el tiempo acumulado.
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") {
        inicioPestaneo = null;
        proximoPestaneo = performance.now() + intervaloParpadeo();
      }
    };

    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    raf = requestAnimationFrame(cuadro);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [state, emotion, blinking, reducido, reinicio]);

  const conNombre = Boolean(label);

  return (
    <span
      data-slot="karia-avatar"
      data-state={state}
      data-emotion={emotion}
      data-floating={floating}
      data-efecto={animacion.efecto}
      role={conNombre ? "img" : undefined}
      aria-label={label}
      aria-hidden={conNombre ? undefined : true}
      className={cn("relative inline-block shrink-0 select-none print:hidden", className)}
      style={{ width: size, height: size }}
    >
      <span className="karia-sombra" />
      <span className="karia-cuerpo">
        <span key={reinicio} className="karia-movimiento">
          <span
            ref={asignarSprite}
            className="karia-sprite"
            style={{ backgroundPosition: posicionFrame(reducido ? animacion.frameReducido : animacion.base.frames[0]) }}
          />
        </span>
        {animacion.puntos && (
          <span className="karia-puntos">
            <i />
            <i />
            <i />
          </span>
        )}
      </span>
    </span>
  );
}
