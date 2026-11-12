"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2, Plus, Tag as TagIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLORES_TAG } from "@/crm/tags/types";
import { crearEtiquetaProducto } from "../actions";
import { normalizarTexto } from "../../filtros-productos";
import { ChipEtiqueta, type EtiquetaBasica } from "./chip-etiqueta";

/** Etiquetas de un producto, con creación rápida desde la búsqueda. */
export function SelectorEtiquetasProducto({
  etiquetas: etiquetasIniciales,
  seleccionadas,
  onChange,
}: {
  etiquetas: EtiquetaBasica[];
  seleccionadas: string[];
  onChange: (ids: string[]) => void;
}) {
  const [etiquetas, setEtiquetas] = useState(etiquetasIniciales);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [creando, startCrear] = useTransition();

  const alternar = (id: string) =>
    onChange(seleccionadas.includes(id) ? seleccionadas.filter((x) => x !== id) : [...seleccionadas, id]);

  const texto = busqueda.trim();
  const existeExacta = etiquetas.some((e) => normalizarTexto(e.nombre) === normalizarTexto(texto));

  const crear = () =>
    startCrear(async () => {
      const color = COLORES_TAG[etiquetas.length % COLORES_TAG.length].valor;
      const r = await crearEtiquetaProducto({ nombre: texto, color });
      if (!r.exito) return void toast.error(r.error);
      setEtiquetas((actuales) => [...actuales, r.datos].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      onChange([...seleccionadas, r.datos.id]);
      setBusqueda("");
    });

  const elegidas = etiquetas.filter((e) => seleccionadas.includes(e.id));

  return (
    <div className="space-y-2" data-slot="selector-etiquetas-producto">
      {elegidas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {elegidas.map((e) => (
            <ChipEtiqueta
              key={e.id}
              etiqueta={e}
              sufijo={
                <button
                  type="button"
                  aria-label={`Quitar ${e.nombre}`}
                  onClick={() => alternar(e.id)}
                  className="ml-0.5 opacity-60 transition-opacity hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              }
            />
          ))}
        </div>
      )}

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-normal")}>
          <span className={cn("flex items-center gap-2", elegidas.length === 0 && "text-muted-foreground")}>
            <TagIcon className="h-3.5 w-3.5" />
            {elegidas.length > 0 ? "Agregar o quitar etiquetas" : "Agregar etiquetas…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar o crear etiqueta…" value={busqueda} onValueChange={setBusqueda} />
            <CommandList>
              <CommandEmpty>{texto ? "Sin coincidencias." : "Aún no hay etiquetas."}</CommandEmpty>
              <CommandGroup>
                {etiquetas.map((e) => (
                  <CommandItem key={e.id} value={e.nombre} onSelect={() => alternar(e.id)}>
                    <Check className={cn("h-4 w-4", seleccionadas.includes(e.id) ? "opacity-100" : "opacity-0")} />
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color ?? "#a8a29e" }} />
                    <span className="truncate">{e.nombre}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {texto && !existeExacta && (
                <CommandGroup forceMount>
                  <CommandItem value={`__crear__${texto}`} onSelect={crear} disabled={creando} forceMount>
                    {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Crear «{texto}»
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
