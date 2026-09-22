"use client";

import { createContext, useCallback, useContext, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Navegación de barras de filtros que escriben en la URL.
 *
 * Por qué existe: un `router.push` suelto desde un handler de filtro deja a
 * Next sin transición pendiente, así que monta el `loading.tsx` del segmento y
 * reemplaza la pantalla entera —incluida la propia barra de filtros— por un
 * esqueleto. Envolver la navegación en `startTransition` mantiene la UI actual
 * montada y expone `pendiente`, con lo que el usuario ve los datos viejos
 * atenuados en vez de un salto a esqueleto.
 *
 * `replace` y no `push`: mismo criterio que el tablero de preparación y el
 * kanban de pipeline. Con `push`, salir de la pantalla obliga a deshacer el
 * historial filtro por filtro.
 *
 * `{ scroll: false }` porque un cambio de filtro no es navegar a otra página:
 * saltar al tope pierde la posición de lectura en la tabla.
 */

interface NavegacionFiltros {
  navegar: (params: URLSearchParams) => void;
  /** Hay una navegación de filtros en vuelo. */
  pendiente: boolean;
}

const Contexto = createContext<NavegacionFiltros | null>(null);

export function ProveedorNavegacionFiltros({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendiente, iniciar] = useTransition();

  const navegar = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      // Sin params hay que navegar al pathname pelado: un "?" colgante produce
      // la misma URL que el navegador ya normaliza y el router puede no
      // disparar la navegación (limpiar el único filtro activo no hacía nada).
      const destino = query ? `${pathname}?${query}` : pathname;
      iniciar(() => router.replace(destino, { scroll: false }));
    },
    [router, pathname]
  );

  return <Contexto.Provider value={{ navegar, pendiente }}>{children}</Contexto.Provider>;
}

export function useNavegacionFiltros(): NavegacionFiltros {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useNavegacionFiltros requiere <ProveedorNavegacionFiltros>");
  return ctx;
}

/**
 * Envuelve lo que depende de los filtros (KPIs, tabla) y lo atenúa mientras el
 * servidor responde. Los hijos pueden ser Server Components: llegan ya
 * renderizados como `children`.
 */
export function ZonaResultados({ children, className }: { children: ReactNode; className?: string }) {
  const { pendiente } = useNavegacionFiltros();
  return (
    <div
      aria-busy={pendiente}
      className={cn(
        "space-y-6 transition-opacity duration-200",
        pendiente && "pointer-events-none opacity-50",
        className
      )}
    >
      {children}
    </div>
  );
}
