"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { queryKeys } from "@/shared/query-keys";
import { listarEstadosProvincia } from "@/shared/entregas/queries-geografia";
import { generarSlug } from "@/shared/lib/slug";

interface SelectorEstadoProvinciaProps {
  /** Si es null, el selector queda deshabilitado con placeholder de guía. */
  paisId: string | null;
  value: string | null;
  onChange: (estadoProvinciaId: string | null) => void;
  disabled?: boolean;
}

// 019-cobertura-geografica-envios — Combobox de estado/provincia,
// dependiente del país elegido (contracts/selector-geografico.md).
export function SelectorEstadoProvincia({ paisId, value, onChange, disabled }: SelectorEstadoProvinciaProps) {
  const { data: estados } = useQuery({
    queryKey: queryKeys.geografia.estados(paisId ?? ""),
    queryFn: () => listarEstadosProvincia(paisId!),
    enabled: !!paisId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Si el país cambia, el estado/provincia elegido ya no aplica — se limpia
  // para no dejar guardado un valor que no pertenece al país actual.
  const paisAnterior = useRef(paisId);
  useEffect(() => {
    if (paisAnterior.current !== paisId) {
      paisAnterior.current = paisId;
      if (value !== null) onChange(null);
    }
  }, [paisId, value, onChange]);

  const opciones: OpcionCombobox[] = (estados ?? []).map((e) => ({
    valor: e.id,
    etiqueta: e.codigo ? `${e.nombre} (${e.codigo})` : e.nombre,
    busqueda: [e.codigo, generarSlug(e.nombre)].filter((v): v is string => !!v),
  }));

  return (
    <Combobox
      opciones={opciones}
      valor={value ?? undefined}
      onChange={(v) => onChange(v || null)}
      placeholder={paisId ? "Selecciona un estado/provincia..." : "Elige un país primero"}
      placeholderBusqueda="Buscar estado o provincia..."
      mensajeVacio="Ningún estado/provincia coincide."
      disabled={disabled || !paisId}
    />
  );
}
