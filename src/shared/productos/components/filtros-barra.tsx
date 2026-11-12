"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Icono = ComponentType<{ className?: string }>;

const CLASE_TRIGGER =
  "inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[activo=true]:border-primary/50 data-[activo=true]:text-foreground";

function ContenidoTrigger({ Icono, etiqueta, valor }: { Icono: Icono; etiqueta: string; valor?: ReactNode }) {
  return (
    <>
      <Icono className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap">
        {etiqueta}
        {valor !== undefined && (
          <>
            : <span className="font-medium text-foreground">{valor}</span>
          </>
        )}
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
    </>
  );
}

/** Filtro de una sola opción: "Estado: Activos". */
export function FiltroUnico<T extends string>({
  Icono,
  etiqueta,
  valor,
  opciones,
  porDefecto,
  onChange,
}: {
  Icono: Icono;
  etiqueta: string;
  valor: T;
  opciones: { valor: T; etiqueta: string }[];
  porDefecto: T;
  onChange: (valor: T) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const actual = opciones.find((o) => o.valor === valor)?.etiqueta ?? "";
  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger className={CLASE_TRIGGER} data-activo={valor !== porDefecto}>
        <ContenidoTrigger Icono={Icono} etiqueta={etiqueta} valor={actual} />
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        <div role="listbox" aria-label={etiqueta}>
          {opciones.map((o) => (
            <button
              key={o.valor}
              type="button"
              role="option"
              aria-selected={o.valor === valor}
              onClick={() => {
                onChange(o.valor);
                setAbierto(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
            >
              <Check className={cn("h-4 w-4", o.valor === valor ? "opacity-100" : "opacity-0")} />
              {o.etiqueta}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Filtro de varias opciones con búsqueda: Categoría, Etiquetas. */
export function FiltroMultiple({
  Icono,
  etiqueta,
  seleccionados,
  opciones,
  onChange,
  vacio = "Sin opciones.",
  nota,
}: {
  Icono: Icono;
  etiqueta: string;
  seleccionados: string[];
  opciones: { valor: string; etiqueta: string; color?: string | null }[];
  onChange: (valores: string[]) => void;
  vacio?: string;
  /** Aclaración al pie (ej. cómo combina las opciones). */
  nota?: string;
}) {
  const alternar = (v: string) =>
    onChange(seleccionados.includes(v) ? seleccionados.filter((x) => x !== v) : [...seleccionados, v]);
  const resumen =
    seleccionados.length === 0
      ? undefined
      : seleccionados.length === 1
        ? opciones.find((o) => o.valor === seleccionados[0])?.etiqueta
        : `${seleccionados.length}`;

  return (
    <Popover>
      <PopoverTrigger className={CLASE_TRIGGER} data-activo={seleccionados.length > 0}>
        <ContenidoTrigger Icono={Icono} etiqueta={etiqueta} valor={resumen} />
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          {opciones.length > 6 && <CommandInput placeholder={`Buscar ${etiqueta.toLowerCase()}…`} />}
          <CommandList>
            <CommandEmpty>{vacio}</CommandEmpty>
            <CommandGroup>
              {opciones.map((o) => (
                <CommandItem key={o.valor} value={o.etiqueta} onSelect={() => alternar(o.valor)}>
                  <Check className={cn("h-4 w-4", seleccionados.includes(o.valor) ? "opacity-100" : "opacity-0")} />
                  {o.color !== undefined && (
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.color ?? "#a8a29e" }} />
                  )}
                  <span className="truncate">{o.etiqueta}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {(seleccionados.length > 0 || nota) && (
            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span>{nota}</span>
              {seleccionados.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="font-medium text-foreground hover:underline">
                  Quitar
                </button>
              )}
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
