"use client";

import { useCallback, useMemo } from "react";
import { MenuAutocomplete, type ItemAutocomplete } from "@/components/ui/menu-autocomplete";
import {
  filterVariables,
  CATEGORY_LABELS,
  type VariableDefinition,
} from "@/configuracion/plantillas/variable-defs";

// Adaptador sobre MenuAutocomplete: el markup, la agrupación y los atajos de
// teclado viven ahí (compartidos con el menú de referencias `@`); acá solo
// queda el mapeo desde VariableDefinition. Props y comportamiento idénticos a
// los que ya consumía editor-contenido-plantilla.tsx.

interface AutocompleteVariablesProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (variable: VariableDefinition) => void;
  onClose: () => void;
}

interface ItemVariable extends ItemAutocomplete {
  variable: VariableDefinition;
}

export function AutocompleteVariables({
  query,
  position,
  onSelect,
  onClose,
}: AutocompleteVariablesProps) {
  const items = useMemo<ItemVariable[]>(
    () =>
      filterVariables(query).map((v) => ({
        id: v.key,
        grupo: CATEGORY_LABELS[v.category],
        icono: v.icon,
        etiqueta: v.label,
        detalle: v.description,
        variable: v,
      })),
    [query],
  );

  const seleccionar = useCallback((item: ItemVariable) => onSelect(item.variable), [onSelect]);

  return (
    <MenuAutocomplete
      items={items}
      consulta={query}
      posicion={position}
      ayuda="Variables disponibles — escribe para filtrar"
      onSeleccionar={seleccionar}
      onCerrar={onClose}
    />
  );
}
