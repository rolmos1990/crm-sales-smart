"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { OpcionCombobox } from "./combobox";

export type { OpcionCombobox };

interface MultiComboboxProps {
  opciones: OpcionCombobox[];
  valores: string[];
  onChange: (valores: string[]) => void;
  placeholder?: string;
  placeholderBusqueda?: string;
  mensajeVacio?: string;
  disabled?: boolean;
  /** Igual que en <Combobox> — búsqueda en servidor con debounce cuando el
   *  usuario escribe, sin perder la lista inicial acotada. */
  onBuscar?: (query: string) => Promise<OpcionCombobox[]>;
  /** Se llama cada vez que cambia la selección, con la etiqueta resuelta de
   *  cada valor seleccionado (incluye las que vinieron de onBuscar, no solo
   *  de `opciones`) — así el caller puede pintar chips "Producto: X ×" sin
   *  tener que re-mapear ids a etiquetas por su cuenta. */
  onChangeConEtiquetas?: (seleccionados: OpcionCombobox[]) => void;
}

/** Multi-select genérico: Popover + Command, igual patrón visual que
 *  <Combobox> y que <SelectorTags> (src/crm/tags/components/selector-tags.tsx)
 *  pero desacoplado de Tag — para reusar en cualquier filtro de selección
 *  múltiple (producto, contacto, etiquetas, etc.) sin duplicar la lógica de
 *  Popover+Command tres veces. */
export function MultiCombobox({
  opciones,
  valores,
  onChange,
  placeholder = "Seleccionar...",
  placeholderBusqueda = "Buscar...",
  mensajeVacio = "Sin resultados.",
  disabled = false,
  onBuscar,
  onChangeConEtiquetas,
}: MultiComboboxProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState<OpcionCombobox[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  // Todas las opciones "vistas" hasta ahora (iniciales + resultados de
  // búsqueda) — permite resolver la etiqueta de un valor seleccionado aunque
  // ya no esté en la lista visible actual (ej. se buscó, se eligió, se borró
  // el texto de búsqueda).
  const [conocidas, setConocidas] = useState<Map<string, OpcionCombobox>>(
    () => new Map(opciones.map((o) => [o.valor, o]))
  );

  useEffect(() => {
    setConocidas((prev) => {
      const next = new Map(prev);
      for (const o of opciones) next.set(o.valor, o);
      return next;
    });
  }, [opciones]);

  useEffect(() => {
    if (!onBuscar) return;
    const termino = busqueda.trim();
    if (!termino) {
      setResultadosBusqueda(null);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const resultado = await onBuscar(termino);
        setResultadosBusqueda(resultado);
        setConocidas((prev) => {
          const next = new Map(prev);
          for (const o of resultado) next.set(o.valor, o);
          return next;
        });
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, onBuscar]);

  const handleOpenChange = (siguiente: boolean) => {
    setAbierto(siguiente);
    if (!siguiente) {
      setBusqueda("");
      setResultadosBusqueda(null);
    }
  };

  const buscandoActivo = !!onBuscar && busqueda.trim().length > 0;
  const listaMostrada = buscandoActivo ? (resultadosBusqueda ?? []) : opciones;

  const seleccionadas = useMemo(
    () => valores.map((v) => conocidas.get(v) ?? { valor: v, etiqueta: v }),
    [valores, conocidas]
  );

  const toggle = (opcion: OpcionCombobox) => {
    const yaElegido = valores.includes(opcion.valor);
    const siguientes = yaElegido
      ? valores.filter((v) => v !== opcion.valor)
      : [...valores, opcion.valor];
    onChange(siguientes);
    onChangeConEtiquetas?.(siguientes.map((v) => conocidas.get(v) ?? { valor: v, etiqueta: v }));
  };

  const etiquetaTrigger =
    seleccionadas.length === 0
      ? placeholder
      : seleccionadas.length === 1
        ? seleccionadas[0].etiqueta
        : `${seleccionadas.length} seleccionados`;

  return (
    <Popover open={abierto} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-normal")}
        aria-expanded={abierto}
        disabled={disabled}
      >
        <span className={cn(seleccionadas.length === 0 && "text-muted-foreground", "truncate")}>
          {etiquetaTrigger}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={!onBuscar}>
          <CommandInput
            placeholder={placeholderBusqueda}
            {...(onBuscar ? { value: busqueda, onValueChange: setBusqueda } : {})}
          />
          <CommandList>
            {buscando ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando...
              </div>
            ) : (
              <>
                <CommandEmpty>{mensajeVacio}</CommandEmpty>
                <CommandGroup>
                  {listaMostrada.map((opcion) => {
                    const elegido = valores.includes(opcion.valor);
                    return (
                      <CommandItem
                        key={opcion.valor}
                        value={opcion.valor}
                        keywords={[opcion.etiqueta, ...(opcion.subtitulo ? [opcion.subtitulo] : []), ...(opcion.busqueda ?? [])]}
                        onSelect={() => toggle(opcion)}
                      >
                        <Check className={cn("mr-2 h-4 w-4", elegido ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                          <span>{opcion.etiqueta}</span>
                          {opcion.subtitulo && (
                            <span className="text-xs text-muted-foreground">{opcion.subtitulo}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
        {seleccionadas.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-border-subtle p-2">
            {seleccionadas.map((opcion) => (
              <span
                key={opcion.valor}
                className="inline-flex items-center gap-1 rounded-full bg-badge-bg text-badge-text text-[11px] px-2 py-0.5"
              >
                {opcion.etiqueta}
                <button
                  type="button"
                  onClick={() => toggle(opcion)}
                  className="hover:text-foreground"
                  aria-label={`Quitar ${opcion.etiqueta}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
