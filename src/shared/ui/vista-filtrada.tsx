"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Datos de una pantalla con barra de filtros (Pedidos, Preparación).
 *
 * Por qué los filtros no viven en la URL: no se quiere exponerlos ni que
 * persistan. El estado de filtros lo tiene el componente cliente, y cada
 * combinación se consulta con una Server Action a través de TanStack Query.
 * Al entrar al módulo el componente se monta con los filtros por defecto, y
 * el servidor ya trae renderizado ese caso (`inicial`), así que la primera
 * pintura no espera ningún fetch.
 *
 * `gcTime: 0`: una combinación de filtros no sobrevive a salir de la
 * pantalla, así que volver al módulo nunca muestra resultados cacheados de
 * una visita anterior.
 *
 * Refresco tras una mutación: las acciones llaman `revalidatePath` (o el
 * componente `router.refresh()`), lo que vuelve a renderizar la página y
 * trae un `inicial` nuevo. Ese cambio es la señal para refrescar también la
 * combinación activa, que el servidor no conoce.
 */
export function useVistaFiltrada<F, D>({
  clave,
  filtros,
  esDefecto,
  inicial,
  consultar,
  habilitado = true,
}: {
  clave: readonly unknown[];
  filtros: F;
  /** Los filtros actuales son los del primer render (los que trae `inicial`). */
  esDefecto: boolean;
  inicial: D;
  consultar: (filtros: F) => Promise<D>;
  /** `false` cuando la pantalla no tiene nada filtrable (se queda con `inicial`). */
  habilitado?: boolean;
}): { datos: D; actualizando: boolean } {
  const queryClient = useQueryClient();
  const queryKey = [...clave, filtros];

  const query = useQuery({
    queryKey,
    queryFn: () => consultar(filtros),
    initialData: esDefecto ? inicial : undefined,
    placeholderData: keepPreviousData,
    gcTime: 0,
    enabled: habilitado,
  });

  const primerInicial = useRef(inicial);
  useEffect(() => {
    if (inicial === primerInicial.current) return;
    primerInicial.current = inicial;
    if (esDefecto) queryClient.setQueryData(queryKey, inicial);
    else void queryClient.invalidateQueries({ queryKey });
    // Solo reacciona a un render nuevo del servidor, no a cambios de filtro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial]);

  useEffect(() => {
    if (query.isError) toast.error(query.error.message || "No se pudieron cargar los datos");
  }, [query.isError, query.error]);

  return { datos: query.data ?? inicial, actualizando: query.isPlaceholderData };
}

// ── Filtros con forma de query string, guardados en estado ──────────────────

interface FiltrosEnEstado {
  /** Filtros vigentes. Mismo formato que tenían en la URL, pero en memoria. */
  params: URLSearchParams;
  /** Reemplaza los filtros vigentes (antes: `router.push(?…)`). */
  navegar: (params: URLSearchParams) => void;
  /** Hay una consulta en vuelo para los filtros recién elegidos. */
  actualizando: boolean;
}

const ContextoFiltros = createContext<FiltrosEnEstado | null>(null);

/**
 * Para barras de filtros que ya estaban escritas contra `URLSearchParams`
 * (Pipeline, Oportunidades): conservan su lógica y solo cambian de dónde leen
 * y a dónde escriben. El dueño del estado es el componente que consulta.
 */
export function ProveedorFiltrosEnEstado({ children, ...valor }: FiltrosEnEstado & { children: ReactNode }) {
  return <ContextoFiltros.Provider value={valor}>{children}</ContextoFiltros.Provider>;
}

export function useFiltrosEnEstado(): FiltrosEnEstado {
  const ctx = useContext(ContextoFiltros);
  if (!ctx) throw new Error("useFiltrosEnEstado requiere <ProveedorFiltrosEnEstado>");
  return ctx;
}

/** Estado de filtros serializado como query string: `""` = sin filtros. */
export function useQueryEnEstado() {
  const [query, setQuery] = useState("");
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const navegar = useCallback((p: URLSearchParams) => setQuery(p.toString()), []);
  const filtros = useMemo(() => Object.fromEntries(params) as Record<string, string>, [params]);
  return { query, params, navegar, filtros };
}

/** Atenúa los resultados mientras llega la combinación de filtros recién elegida. */
export function ZonaResultados({
  actualizando,
  children,
  className,
}: {
  actualizando: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-busy={actualizando}
      className={cn(
        "space-y-6 transition-opacity duration-200",
        actualizando && "pointer-events-none opacity-50",
        className
      )}
    >
      {children}
    </div>
  );
}
