"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { queryKeys } from "@/shared/query-keys";
import { listarEstadosProvincia, listarCoberturaPorProvincia } from "@/shared/entregas/queries-geografia";
import { generarSlug } from "@/shared/lib/slug";
import { filtrarProvincia } from "@/shared/entregas/filtro-provincia";
import { debeLimpiarEstadoProvincia } from "@/shared/entregas/debe-limpiar-estado-provincia";

interface SelectorEstadoProvinciaProps {
  /** Si es null, el selector queda deshabilitado con placeholder de guía. */
  paisId: string | null;
  /**
   * Acota los lugares que alimentan la búsqueda a los que cubre este
   * transportista. Sin él se consideran los de todos — es el estado normal
   * mientras no se eligió transportista.
   *
   * No reduce la lista de provincias: esa sale del catálogo de geografía y
   * siempre está completa, así que se puede elegir una a mano aunque el
   * transportista no la cubra.
   */
  transportistaId?: string | null;
  value: string | null;
  onChange: (estadoProvinciaId: string | null) => void;
  disabled?: boolean;
}

// 019-cobertura-geografica-envios — Combobox de estado/provincia,
// dependiente del país elegido (contracts/selector-geografico.md).
export function SelectorEstadoProvincia({ paisId, transportistaId, value, onChange, disabled }: SelectorEstadoProvinciaProps) {
  const { data: estados } = useQuery({
    queryKey: queryKeys.geografia.estados(paisId ?? ""),
    queryFn: () => listarEstadosProvincia(paisId!),
    enabled: !!paisId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Lugares cubiertos por cada provincia (distritos, corregimientos, sectores
  // y alias de las zonas cargadas). Permite encontrar "Chiriquí" escribiendo
  // "Boquete": al cotizar uno recuerda el lugar, no a qué provincia pertenece.
  // Falla en silencio a propósito — es una ayuda de búsqueda, no un requisito
  // para elegir la provincia.
  const { data: cobertura } = useQuery({
    queryKey: queryKeys.geografia.cobertura(paisId ?? "", transportistaId ?? undefined),
    queryFn: () => listarCoberturaPorProvincia(paisId!, transportistaId ?? undefined),
    enabled: !!paisId,
    staleTime: 5 * 60 * 1000,
  });

  const lugaresPorProvincia = useMemo(
    () => new Map((cobertura ?? []).map((c) => [c.estadoProvinciaId, c.lugares])),
    [cobertura],
  );

  // Si el país cambia, el estado/provincia elegido ya no aplica — se limpia
  // para no dejar guardado un valor que no pertenece al país actual. El
  // criterio exacto (y por qué resolver el país por primera vez NO cuenta
  // como un cambio) vive en debeLimpiarEstadoProvincia, con sus tests.
  const paisAnterior = useRef(paisId);
  useEffect(() => {
    if (paisAnterior.current === paisId) return;
    const limpiar = debeLimpiarEstadoProvincia({
      paisAnterior: paisAnterior.current,
      paisActual: paisId,
      estadoProvinciaActual: value,
    });
    paisAnterior.current = paisId;
    if (limpiar) onChange(null);
  }, [paisId, value, onChange]);

  const opciones: OpcionCombobox[] = (estados ?? []).map((e) => {
    const lugares = lugaresPorProvincia.get(e.id) ?? [];
    return {
      valor: e.id,
      etiqueta: e.codigo ? `${e.nombre} (${e.codigo})` : e.nombre,
      // Se muestran algunos para que se entienda POR QUÉ apareció al buscar
      // un distrito; el resto solo alimenta la búsqueda.
      subtitulo: lugares.length > 0 ? `Cubre ${resumirLugares(lugares)}` : undefined,
      busqueda: [
        e.codigo,
        generarSlug(e.nombre),
        // Crudo y en slug: cmdk puntúa mejor el texto natural, y el slug
        // cubre las diferencias de tildes y mayúsculas.
        ...lugares,
        ...lugares.map(generarSlug),
      ].filter((v): v is string => !!v),
    };
  });

  return (
    <Combobox
      opciones={opciones}
      filtro={filtrarProvincia}
      valor={value ?? undefined}
      onChange={(v) => onChange(v || null)}
      placeholder={paisId ? "Selecciona un estado/provincia..." : "Elige un país primero"}
      placeholderBusqueda="Buscar por provincia, distrito o alias..."
      mensajeVacio="Ningún estado/provincia coincide."
      disabled={disabled || !paisId}
    />
  );
}

const MAX_LUGARES_VISIBLES = 3;

/** "Boquete, David, Volcán y 5 más" — el subtítulo del Combobox es una línea. */
function resumirLugares(lugares: string[]): string {
  const visibles = lugares.slice(0, MAX_LUGARES_VISIBLES).join(", ");
  const resto = lugares.length - MAX_LUGARES_VISIBLES;
  return resto > 0 ? `${visibles} y ${resto} más` : visibles;
}
