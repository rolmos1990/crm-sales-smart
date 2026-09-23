"use client";

import { useState } from "react";
import { Minus, Package, Plus, Trash2 } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import type { ProductoParaComponente } from "../queries";
import type { ComponenteCombo } from "../types";

interface Props {
  valores: ComponenteCombo[];
  onChange: (componentes: ComponenteCombo[]) => void;
  /** Productos simples de la instancia (ya excluye combos y al propio producto). */
  disponibles: ProductoParaComponente[];
  precioCombo: number;
  moneda: string;
}

const formatear = (moneda: string, valor: number) =>
  `${moneda} ${valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * 029-combos-productos-compuestos — componentes del combo. Agregar un
 * producto que ya está en la lista sube su cantidad en vez de duplicarlo
 * (el servidor aplica la misma regla). El "valor de los componentes" es solo
 * una referencia interna: nunca llega a pedidos ni cotizaciones.
 */
export function EditorComponentesCombo({ valores, onChange, disponibles, precioCombo, moneda }: Props) {
  const [abierto, setAbierto] = useState(false);
  const porId = new Map(disponibles.map((p) => [p.id, p]));

  const agregar = (productoId: string) => {
    const existente = valores.find((c) => c.productoId === productoId);
    onChange(
      existente
        ? valores.map((c) => (c.productoId === productoId ? { ...c, cantidad: c.cantidad + 1 } : c))
        : [...valores, { productoId, cantidad: 1 }],
    );
    setAbierto(false);
  };

  const cambiarCantidad = (productoId: string, cantidad: number) =>
    onChange(valores.map((c) => (c.productoId === productoId ? { ...c, cantidad: Math.max(1, Math.floor(cantidad) || 1) } : c)));

  const valorComponentes = valores.reduce((acc, c) => acc + (porId.get(c.productoId)?.precio ?? 0) * c.cantidad, 0);

  return (
    <div className="space-y-3">
      {valores.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 dark:border-white/15 px-3 py-3 text-xs text-stone-500 dark:text-stone-400">
          Agrega los productos que forman este combo y cuántas unidades de cada uno lleva.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 dark:divide-white/10 rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-transparent">
          {valores.map((c) => {
            const producto = porId.get(c.productoId);
            return (
              <li key={c.productoId} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{producto?.nombre ?? "Producto no disponible"}</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500">
                    {producto ? formatear(producto.moneda, producto.precio) : "—"}
                    {producto?.manejaStock && ` · ${producto.cantidadDisponible} en stock`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Quitar una unidad"
                    onClick={() => cambiarCantidad(c.productoId, c.cantidad - 1)}
                    disabled={c.cantidad <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 dark:border-white/10 text-stone-500 hover:bg-stone-100 dark:hover:bg-white/5 disabled:opacity-40"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={c.cantidad}
                    onChange={(e) => cambiarCantidad(c.productoId, e.target.valueAsNumber)}
                    aria-label={`Cantidad de ${producto?.nombre ?? "componente"}`}
                    className="h-7 w-14 px-1 text-center text-sm tabular-nums"
                  />
                  <button
                    type="button"
                    aria-label="Agregar una unidad"
                    onClick={() => cambiarCantidad(c.productoId, c.cantidad + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 dark:border-white/10 text-stone-500 hover:bg-stone-100 dark:hover:bg-white/5"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={`Quitar ${producto?.nombre ?? "componente"}`}
                  onClick={() => onChange(valores.filter((v) => v.productoId !== c.productoId))}
                  className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-white/5 dark:hover:text-stone-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-100 dark:hover:bg-white/10">
          <Plus className="h-3.5 w-3.5" />
          Agregar componente
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar producto..." />
            <CommandList>
              <CommandEmpty>No hay productos simples para agregar.</CommandEmpty>
              <CommandGroup>
                {disponibles.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.nombre} ${p.sku ?? ""}`}
                    onSelect={() => agregar(p.id)}
                    className="flex cursor-pointer items-center gap-2.5 py-2"
                  >
                    <Package className="h-3.5 w-3.5 flex-shrink-0 text-stone-400" />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.nombre}</span>
                    <span className="text-xs tabular-nums text-stone-500">{formatear(p.moneda, p.precio)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {valores.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-stone-100/70 dark:bg-white/5 px-3 py-2 text-xs">
          <span className="text-stone-500 dark:text-stone-400">
            Valor de los componentes (referencia interna):{" "}
            <span className="font-medium tabular-nums text-stone-700 dark:text-stone-300">{formatear(moneda, valorComponentes)}</span>
          </span>
          <span className="text-stone-500 dark:text-stone-400">
            Precio del combo:{" "}
            <span className="font-semibold tabular-nums text-stone-800 dark:text-stone-100">{formatear(moneda, precioCombo)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
