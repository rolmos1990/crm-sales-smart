"use client";

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FiltrosVistaContactos } from "../schema";
import { ETIQUETA_GRUPO_CANAL, GRUPOS_CANAL } from "../segmentacion/canales";
import type { Segmento } from "../segmentacion/condiciones";
import type { IndicadoresContactos } from "../types";
import { ETIQUETA_INTERES, ETIQUETA_TIPO } from "./insignias-contacto";

const TODOS = "__todos__";

interface Opcion {
  valor: string;
  etiqueta: string;
}

/** Select de filtro: "todos" = sin filtro. `items` siempre (docs/selects.md). */
function FiltroSelect({
  rotulo,
  valor,
  opciones,
  onCambiar,
  className,
}: {
  rotulo: string;
  valor: string | undefined;
  opciones: Opcion[];
  onCambiar: (valor: string | undefined) => void;
  className?: string;
}) {
  const todas: Opcion[] = [{ valor: TODOS, etiqueta: `${rotulo}: Todos` }, ...opciones];
  const items = Object.fromEntries(todas.map((o) => [o.valor, o.valor === TODOS ? o.etiqueta : `${rotulo}: ${o.etiqueta}`]));
  return (
    <Select items={items} value={valor ?? TODOS} onValueChange={(v) => onCambiar(!v || v === TODOS ? undefined : v)}>
      <SelectTrigger className={cn("w-full sm:w-auto", className)} aria-label={rotulo}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {todas.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.valor === TODOS ? "Todos" : o.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const OPCIONES_TIPO: Opcion[] = (["CLIENTE", "INTERESADO", "LEAD"] as const).map((v) => ({ valor: v, etiqueta: ETIQUETA_TIPO[v] }));
const OPCIONES_INTERES: Opcion[] = (["ALTO", "MEDIO", "BAJO", "SIN_EVALUAR"] as const).map((v) => ({ valor: v, etiqueta: ETIQUETA_INTERES[v] }));
const OPCIONES_CANAL: Opcion[] = GRUPOS_CANAL.map((v) => ({ valor: v, etiqueta: ETIQUETA_GRUPO_CANAL[v] }));
const OPCIONES_ULTIMA_ACTIVIDAD: Opcion[] = [
  { valor: "HOY", etiqueta: "Hoy" },
  { valor: "ULTIMOS_7", etiqueta: "Últimos 7 días" },
  { valor: "ULTIMOS_30", etiqueta: "Últimos 30 días" },
  { valor: "MAS_DE_30", etiqueta: "Más de 30 días" },
  { valor: "SIN_ACTIVIDAD", etiqueta: "Sin actividad" },
];
export const ETIQUETA_SEGUIMIENTO = {
  AL_DIA: "Al día",
  PENDIENTE: "Pendiente de seguimiento",
  POR_RECUPERAR: "Por recuperar",
  INACTIVO: "Inactivo",
} as const;
const OPCIONES_SEGUIMIENTO: Opcion[] = Object.entries(ETIQUETA_SEGUIMIENTO).map(([valor, etiqueta]) => ({ valor, etiqueta }));
const OPCIONES_PREFERENCIA: Opcion[] = [
  { valor: "CONTACTABLE", etiqueta: "Contactable" },
  { valor: "NO_CONTACTAR", etiqueta: "No contactar" },
];

const PESTANAS: Array<{ segmento: Segmento; etiqueta: string; clave: keyof IndicadoresContactos }> = [
  { segmento: "TODOS", etiqueta: "Todos", clave: "total" },
  { segmento: "CLIENTES", etiqueta: "Clientes", clave: "clientes" },
  { segmento: "INTERESADOS", etiqueta: "Interesados", clave: "interesados" },
  { segmento: "POR_RECUPERAR", etiqueta: "Por recuperar", clave: "porRecuperar" },
  { segmento: "LEADS", etiqueta: "Leads", clave: "leads" },
];

export function ContactosPestanas({
  indicadores,
  segmento,
  onSeleccionar,
}: {
  indicadores: IndicadoresContactos;
  segmento: Segmento;
  onSeleccionar: (segmento: Segmento) => void;
}) {
  return (
    <div role="tablist" aria-label="Segmentos de contactos" className="flex gap-1 overflow-x-auto border-b border-border-subtle">
      {PESTANAS.map((p) => {
        const activa = segmento === p.segmento;
        return (
          <button
            key={p.segmento}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => onSeleccionar(p.segmento)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:text-foreground",
              activa ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {p.etiqueta} <span className="tabular-nums text-muted-foreground">({indicadores[p.clave].toLocaleString("es")})</span>
          </button>
        );
      })}
    </div>
  );
}

export function ContactosFiltros({
  filtros,
  onCambiar,
  onLimpiar,
  hayFiltrosActivos,
  mostrarAvanzados,
}: {
  filtros: FiltrosVistaContactos;
  onCambiar: (cambios: Partial<FiltrosVistaContactos>) => void;
  onLimpiar: () => void;
  hayFiltrosActivos: boolean;
  /** "Más filtros" (seguimiento, preferencia) — Historia 3. */
  mostrarAvanzados: boolean;
}) {
  const [texto, setTexto] = useState(filtros.busqueda);

  // El cambio desde afuera (Limpiar) vuelve a sincronizar el input.
  useEffect(() => setTexto(filtros.busqueda), [filtros.busqueda]);

  useEffect(() => {
    if (texto.trim() === filtros.busqueda) return;
    const t = setTimeout(() => onCambiar({ busqueda: texto.trim() }), 300);
    return () => clearTimeout(t);
  }, [texto, filtros.busqueda, onCambiar]);

  const avanzadosActivos = [filtros.seguimiento, filtros.preferencia].filter(Boolean).length;

  return (
    <div data-slot="contactos-filtros" className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative w-full lg:max-w-sm lg:flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre, teléfono o email…"
          aria-label="Buscar contactos"
          className="pl-8"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <FiltroSelect rotulo="Tipo" valor={filtros.tipo} opciones={OPCIONES_TIPO} onCambiar={(v) => onCambiar({ tipo: v as FiltrosVistaContactos["tipo"] })} />
        <FiltroSelect rotulo="Interés" valor={filtros.interes} opciones={OPCIONES_INTERES} onCambiar={(v) => onCambiar({ interes: v as FiltrosVistaContactos["interes"] })} />
        <FiltroSelect rotulo="Canal" valor={filtros.canal} opciones={OPCIONES_CANAL} onCambiar={(v) => onCambiar({ canal: v as FiltrosVistaContactos["canal"] })} />
        <FiltroSelect
          rotulo="Última actividad"
          valor={filtros.ultimaActividad}
          opciones={OPCIONES_ULTIMA_ACTIVIDAD}
          onCambiar={(v) => onCambiar({ ultimaActividad: v as FiltrosVistaContactos["ultimaActividad"] })}
        />
        {mostrarAvanzados && (
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="sm" className="relative h-8" />}>
              <SlidersHorizontal className="size-4" aria-hidden />
              Más filtros
              {avanzadosActivos > 0 && (
                <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground tabular-nums">
                  {avanzadosActivos}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent align="end" className="flex w-64 flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Seguimiento
                <FiltroSelect
                  rotulo="Seguimiento"
                  valor={filtros.seguimiento}
                  opciones={OPCIONES_SEGUIMIENTO}
                  onCambiar={(v) => onCambiar({ seguimiento: v as FiltrosVistaContactos["seguimiento"] })}
                  className="sm:w-full"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Preferencia de contacto
                <FiltroSelect
                  rotulo="Preferencia"
                  valor={filtros.preferencia}
                  opciones={OPCIONES_PREFERENCIA}
                  onCambiar={(v) => onCambiar({ preferencia: v as FiltrosVistaContactos["preferencia"] })}
                  className="sm:w-full"
                />
              </label>
            </PopoverContent>
          </Popover>
        )}
        {hayFiltrosActivos && (
          <Button variant="link" size="sm" className="h-8 px-1" onClick={onLimpiar}>
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}
