"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import {
  formatearFecha,
  formatearFechaCorta,
  formatearFechaHora,
  formatearFechaLarga,
  formatearFechaRelativa,
  formatearHora,
  PREFERENCIAS_FECHA_DEFAULT,
  type PreferenciasFecha,
} from "./formato";

const COOKIE_ZONA = "karia_tz";
const UN_ANIO_EN_SEGUNDOS = 31_536_000;

/**
 * Preferencias de fecha para todo el árbol de cliente.
 *
 * El valor llega **resuelto desde el servidor** como prop. El cliente nunca
 * llama a `Intl.DateTimeFormat().resolvedOptions().timeZone` durante el render:
 * si lo hiciera, el HTML del servidor y el del cliente diferirían y habría
 * hydration mismatch. La detección del navegador ocurre solo en un efecto, y
 * únicamente para dejar la pista en una cookie que el *próximo* request podrá
 * usar.
 *
 * El default del contexto existe para que los componentes que se renderizan
 * fuera del provider (login, páginas legales) sean deterministas en vez de
 * lanzar.
 */
const ContextoFecha = createContext<PreferenciasFecha>(PREFERENCIAS_FECHA_DEFAULT);

export function TimeZoneProvider({
  valor,
  children,
}: {
  valor?: PreferenciasFecha;
  children: React.ReactNode;
}) {
  const preferencias = valor ?? PREFERENCIAS_FECHA_DEFAULT;

  useEffect(() => {
    // Efecto puro: no alimenta el render, así que no puede causar mismatch.
    try {
      const detectada = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!detectada) return;
      const actual = document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${COOKIE_ZONA}=`))
        ?.slice(COOKIE_ZONA.length + 1);
      if (actual === detectada) return;

      const seguro = window.location.protocol === "https:" ? "; Secure" : "";
      // SameSite=Lax y no Strict: con Strict la cookie se perdería al volver
      // del callback de autenticación de Supabase.
      document.cookie =
        `${COOKIE_ZONA}=${encodeURIComponent(detectada)}; Path=/; Max-Age=${UN_ANIO_EN_SEGUNDOS}; SameSite=Lax${seguro}`;
    } catch {
      // Sin Intl utilizable o sin acceso a cookies: se sigue con la zona de
      // empresa, que es la que manda igual.
    }
  }, []);

  return <ContextoFecha.Provider value={preferencias}>{children}</ContextoFecha.Provider>;
}

/** Preferencias completas (zona, locale, formatos). */
export function usePreferenciasFecha(): PreferenciasFecha {
  return useContext(ContextoFecha);
}

/**
 * Solo la zona de presentación.
 *
 * Ojo: para decidir si algo "es hoy" en términos de negocio, la zona debe venir
 * del servidor (`sesion.zonaNegocio`), no de acá.
 */
export function useTimeZone(): string {
  return useContext(ContextoFecha).zonaHoraria;
}

/**
 * Formateadores ya atados a las preferencias actuales — evita repetir el
 * segundo argumento en cada llamada.
 */
export function useFormatearFecha() {
  const p = usePreferenciasFecha();
  return useMemo(
    () => ({
      fecha: (v: Date | string | number | null | undefined) => formatearFecha(v, p),
      fechaHora: (v: Date | string | number | null | undefined) => formatearFechaHora(v, p),
      hora: (v: Date | string | number | null | undefined) => formatearHora(v, p),
      larga: (v: Date | string | number | null | undefined) => formatearFechaLarga(v, p),
      corta: (v: Date | string | number | null | undefined) => formatearFechaCorta(v, p),
      relativa: (v: Date | string | number | null | undefined) => formatearFechaRelativa(v, p),
    }),
    [p],
  );
}
