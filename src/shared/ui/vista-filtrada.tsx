"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
}: {
  clave: readonly unknown[];
  filtros: F;
  /** Los filtros actuales son los del primer render (los que trae `inicial`). */
  esDefecto: boolean;
  inicial: D;
  consultar: (filtros: F) => Promise<D>;
}): { datos: D; actualizando: boolean } {
  const queryClient = useQueryClient();
  const queryKey = [...clave, filtros];

  const query = useQuery({
    queryKey,
    queryFn: () => consultar(filtros),
    initialData: esDefecto ? inicial : undefined,
    placeholderData: keepPreviousData,
    gcTime: 0,
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
