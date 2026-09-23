"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Package, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FILTRO_CATALOGO_LABELS, type FiltroCatalogo, type ProductoCatalogo, type VarianteCatalogo } from "../types";
import { filtrarCatalogo } from "./filtro-catalogo";

interface SelectorProductoLineaProps {
  productos: ProductoCatalogo[];
  productoId?: string;
  /** 030 — variante ya elegida en la línea (para el rótulo). */
  varianteId?: string;
  /** Con variantes, se llama recién después de elegir la variante. */
  onSeleccionar: (producto: ProductoCatalogo, variante?: VarianteCatalogo) => void;
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
  varianteId,
  onSeleccionar,
  onLimpiar,
  filtroInicial = "TODOS",
}: SelectorProductoLineaProps) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState<FiltroCatalogo>(filtroInicial);
  // 030 — segundo paso: el usuario sigue viendo "Base Luminaria" como un
  // solo producto y recién después elige su variante.
  const [eligiendoVariante, setEligiendoVariante] = useState<ProductoCatalogo | null>(null);

  // Se busca en el catálogo completo, no en el filtrado: una línea ya guardada
  // con un producto que dejó de ser de venta directa debe seguir mostrando su
  // nombre (solo no se puede volver a elegir).
  const productoSeleccionado = productos.find((p) => p.id === productoId);
  // Incluye inactivas: una línea histórica sigue mostrando su variante.
  const varianteSeleccionada = productoSeleccionado?.variantes?.find((v) => v.id === varianteId);
  const visibles = filtrarCatalogo(productos, filtro);

  const cambiarApertura = (valor: boolean) => {
    setAbierto(valor);
    if (!valor) setEligiendoVariante(null);
  };

  const elegir = (p: ProductoCatalogo) => {
    if (p.tieneVariantes) {
      setEligiendoVariante(p);
      return;
    }
    onSeleccionar(p);
    cambiarApertura(false);
  };

  return (
    <div className="flex items-center gap-1 mb-1">
      <Popover open={abierto} onOpenChange={cambiarApertura}>
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
            {productoSeleccionado
              ? varianteSeleccionada
                ? `${productoSeleccionado.nombre} — ${varianteSeleccionada.nombre}`
                : productoSeleccionado.nombre
              : "Del catálogo"}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          {eligiendoVariante ? (
            <SelectorVariante
              producto={eligiendoVariante}
              onVolver={() => setEligiendoVariante(null)}
              onElegir={(v) => {
                onSeleccionar(eligiendoVariante, v);
                cambiarApertura(false);
              }}
            />
          ) : (
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
                    onSelect={() => elegir(p)}
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
                        {p.tieneVariantes && (
                          <span className="flex-shrink-0 text-[10px] text-stone-400 dark:text-stone-500">
                            {p.variantes.filter((v) => v.activo).length} variantes
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
          )}
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

function SelectorVariante({
  producto,
  onVolver,
  onElegir,
}: {
  producto: ProductoCatalogo;
  onVolver: () => void;
  onElegir: (variante: VarianteCatalogo) => void;
}) {
  const activas = producto.variantes.filter((v) => v.activo);
  return (
    <div>
      <div className="flex items-center gap-1.5 border-b border-stone-100 dark:border-white/10 px-2 py-2">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver a productos"
          className="rounded-md p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-white/5"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{producto.nombre}</p>
          <p className="text-xs text-stone-400 dark:text-stone-500">Elige la variante</p>
        </div>
      </div>
      {activas.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-stone-500">Este producto no tiene variantes activas.</p>
      ) : (
        <ul role="listbox" aria-label={`Variantes de ${producto.nombre}`} className="max-h-72 overflow-y-auto py-1">
          {activas.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => onElegir(v)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-100 dark:hover:bg-white/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{v.nombre}</div>
                  <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
                    {v.sku && <span className="font-mono">{v.sku}</span>}
                    {v.disponibilidad !== null && (
                      <span className={cn(v.disponibilidad === 0 && "text-red-500 dark:text-red-400")}>
                        {v.disponibilidad === 0 ? "Sin stock" : `${v.disponibilidad} disponibles`}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold tabular-nums text-stone-700 dark:text-stone-300">
                  {producto.moneda} {v.precio.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-stone-300" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
