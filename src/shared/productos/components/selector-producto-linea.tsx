"use client";

import { useState } from "react";
import { Package, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FILTRO_CATALOGO_LABELS, type FiltroCatalogo, type ProductoCatalogo } from "../types";
import { filtrarCatalogo } from "./filtro-catalogo";

interface SelectorProductoLineaProps {
  productos: ProductoCatalogo[];
  productoId?: string;
  onSeleccionar: (producto: ProductoCatalogo) => void;
  onLimpiar: () => void;
  /** 029 — pestaña con la que abre (preferencia de la empresa). El usuario
   *  puede cambiarla; nunca restringe lo que se puede elegir. */
  filtroInicial?: FiltroCatalogo;
}

const FILTROS: FiltroCatalogo[] = ["TODOS", "PRODUCTOS", "COMBOS"];

const VACIO_POR_FILTRO: Record<FiltroCatalogo, string> = {
  TODOS: "Sin productos en catálogo.",
  PRODUCTOS: "No hay productos para venta directa.",
  COMBOS: "Todavía no hay combos. Créalos desde Productos.",
};

export function SelectorProductoLinea({
  productos,
  productoId,
  onSeleccionar,
  onLimpiar,
  filtroInicial = "TODOS",
}: SelectorProductoLineaProps) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState<FiltroCatalogo>(filtroInicial);

  // Se busca en el catálogo completo, no en el filtrado: una línea ya guardada
  // con un producto que dejó de ser de venta directa debe seguir mostrando su
  // nombre (solo no se puede volver a elegir).
  const productoSeleccionado = productos.find((p) => p.id === productoId);
  const visibles = filtrarCatalogo(productos, filtro);

  return (
    <div className="flex items-center gap-1 mb-1">
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger
          className={cn(
            "inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-xs border transition-colors min-w-0 max-w-[220px]",
            productoSeleccionado
              ? "bg-lime-50 dark:bg-lime-500/10 border-lime-200 dark:border-lime-500/25 text-lime-700 dark:text-lime-400"
              : "bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 text-stone-400 dark:text-stone-500 hover:border-stone-300 dark:hover:border-white/20 hover:text-stone-600 dark:hover:text-stone-300"
          )}
        >
          {productoSeleccionado?.imagenUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={productoSeleccionado.imagenUrl}
              alt=""
              className="h-3.5 w-3.5 rounded object-cover flex-shrink-0"
            />
          ) : (
            <Package className="h-3 w-3 flex-shrink-0" />
          )}
          <span className="truncate">
            {productoSeleccionado ? productoSeleccionado.nombre : "Del catálogo"}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar producto..." />
            <div role="tablist" aria-label="Tipo de producto" className="flex gap-1 border-b border-stone-100 dark:border-white/10 px-2 py-1.5">
              {FILTROS.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filtro === f}
                  onClick={() => setFiltro(f)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    filtro === f
                      ? "bg-stone-900 text-white dark:bg-white/15 dark:text-stone-50"
                      : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-white/5"
                  )}
                >
                  {FILTRO_CATALOGO_LABELS[f]}
                </button>
              ))}
            </div>
            <CommandList>
              <CommandEmpty>{visibles.length === 0 ? VACIO_POR_FILTRO[filtro] : "Ningún producto coincide con la búsqueda."}</CommandEmpty>
              <CommandGroup>
                {visibles.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.nombre} ${p.sku ?? ""}`}
                    onSelect={() => {
                      onSeleccionar(p);
                      setAbierto(false);
                    }}
                    className="flex items-center gap-2.5 py-2 cursor-pointer"
                  >
                    {p.imagenUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imagenUrl}
                        alt=""
                        className="h-7 w-7 rounded object-cover flex-shrink-0 border border-stone-200 dark:border-white/10"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 flex items-center justify-center flex-shrink-0">
                        <Package className="h-3.5 w-3.5 text-stone-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm leading-tight truncate">{p.nombre}</span>
                        {p.esCombo && (
                          <span className="flex-shrink-0 rounded border border-stone-300 dark:border-white/15 px-1 text-[9px] font-semibold tracking-wide text-stone-500 dark:text-stone-400">
                            COMBO
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
                        {p.sku && <span className="font-mono">{p.sku}</span>}
                        {p.disponibilidad !== null && (
                          <span className={cn(p.disponibilidad === 0 && "text-red-500 dark:text-red-400")}>
                            {p.disponibilidad === 0 ? "Sin stock" : `${p.disponibilidad} disponibles`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs font-semibold tabular-nums text-right text-stone-700 dark:text-stone-300 flex-shrink-0">
                      <div>{p.moneda} {Number(p.precio).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</div>
                      {p.unidad && (
                        <div className="font-normal text-stone-400 dark:text-stone-500">/{p.unidad}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {productoSeleccionado && (
        <button
          type="button"
          onClick={onLimpiar}
          className="h-5 w-5 rounded flex items-center justify-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors flex-shrink-0"
          aria-label="Quitar producto"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
