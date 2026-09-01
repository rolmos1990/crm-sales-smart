"use client";

import { useQuery } from "@tanstack/react-query";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { queryKeys } from "@/shared/query-keys";
import { listarPaises } from "@/shared/entregas/queries-geografia";
import { generarSlug } from "@/shared/lib/slug";

interface SelectorPaisProps {
  value: string | null;
  onChange: (paisId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

// 019-cobertura-geografica-envios — Combobox de país con bandera + nombre +
// código ISO (contracts/selector-geografico.md). El catálogo completo cabe
// en una sola respuesta cacheada (staleTime largo — prácticamente nunca
// cambia), filtrado en cliente por el propio Combobox.
export function SelectorPais({ value, onChange, disabled, placeholder = "Selecciona un país..." }: SelectorPaisProps) {
  const { data: paises } = useQuery({
    queryKey: queryKeys.geografia.paises(),
    queryFn: () => listarPaises(),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const opciones: OpcionCombobox[] = (paises ?? []).map((p) => ({
    valor: p.id,
    etiqueta: `${p.banderaEmoji ? `${p.banderaEmoji} ` : ""}${p.nombre} (${p.codigo})`,
    // generarSlug(p.nombre) — el catálogo trae nombres en inglés sin tilde
    // (ej. "Panama"); esto permite encontrarlo igual buscando "Panamá".
    busqueda: [p.codigo, p.codigoAlpha3, p.indicativoTelefonico, generarSlug(p.nombre)].filter((v): v is string => !!v),
  }));

  return (
    <Combobox
      opciones={opciones}
      valor={value ?? undefined}
      onChange={(v) => onChange(v || null)}
      placeholder={placeholder}
      placeholderBusqueda="Buscar país o código ISO..."
      mensajeVacio="Ningún país coincide."
      disabled={disabled}
    />
  );
}
