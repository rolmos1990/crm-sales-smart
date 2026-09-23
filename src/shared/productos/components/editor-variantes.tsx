"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  claveVariante,
  generarCombinaciones,
  MAX_ATRIBUTOS,
  MAX_VARIANTES,
  nombreVariante,
  type AtributoVariante,
} from "../variantes";
import type { VarianteEditable } from "../types";

interface Props {
  atributos: AtributoVariante[];
  variantes: VarianteEditable[];
  onChange: (atributos: AtributoVariante[], variantes: VarianteEditable[]) => void;
  manejaStock: boolean;
  precioBase: number;
  moneda: string;
  /** Solo al convertir un producto existente con stock: hay que repartirlo. */
  stockPorDistribuir?: number;
}

/**
 * 030-variantes-producto — atributos → combinaciones → tabla editable, todo en
 * la misma tarjeta (sin modales). Al cambiar los atributos, las combinaciones
 * que siguen existiendo conservan su SKU/precio/stock (se emparejan por su
 * clave normalizada); las que desaparecen las desactiva el servidor si ya se
 * vendieron.
 */
export function EditorVariantes({ atributos, variantes, onChange, manejaStock, precioBase, moneda, stockPorDistribuir }: Props) {
  const regenerar = (nuevosAtributos: AtributoVariante[]) => {
    // Se empareja por los VALORES en orden de atributo, no por el nombre del
    // atributo: así renombrar un atributo, agregar un valor o un atributo
    // nuevo no pierde el SKU/stock ya cargado. Cada variante previa se reusa
    // una sola vez, para no duplicar su stock en la tabla.
    const valoresDe = (v: Record<string, string>, attrs: AtributoVariante[]) =>
      attrs.map((a) => (v[a.nombre.trim()] ?? "").trim().toLowerCase());
    const previas = variantes.map((v) => ({ v, valores: valoresDe(v.valores, atributos) }));
    const usadas = new Set<number>();
    const nuevas = generarCombinaciones(nuevosAtributos).map((valores) => {
      const actuales = valoresDe(valores, nuevosAtributos);
      const n = Math.min(actuales.length, atributos.length);
      const i = previas.findIndex(
        (p, j) => !usadas.has(j) && n > 0 && p.valores.slice(0, n).every((valor, k) => valor === actuales[k]),
      );
      if (i === -1) return { valores, sku: "", precio: null, cantidadDisponible: 0, activo: true };
      usadas.add(i);
      return { ...previas[i].v, valores };
    });
    onChange(nuevosAtributos, nuevas);
  };

  const actualizarAtributo = (indice: number, cambios: Partial<AtributoVariante>) =>
    regenerar(atributos.map((a, i) => (i === indice ? { ...a, ...cambios } : a)));

  const actualizarVariante = (indice: number, cambios: Partial<VarianteEditable>) =>
    onChange(atributos, variantes.map((v, i) => (i === indice ? { ...v, ...cambios } : v)));

  const asignado = variantes.reduce((acc, v) => acc + (v.cantidadDisponible || 0), 0);
  const formatear = (valor: number) => `${moneda} ${valor.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {/* Atributos */}
      <div className="space-y-3">
        {atributos.map((atributo, i) => (
          <FilaAtributo
            key={i}
            atributo={atributo}
            onNombre={(nombre) => actualizarAtributo(i, { nombre })}
            onValores={(valores) => actualizarAtributo(i, { valores })}
            onQuitar={() => regenerar(atributos.filter((_, j) => j !== i))}
          />
        ))}
        {atributos.length < MAX_ATRIBUTOS && (
          <button
            type="button"
            onClick={() => onChange([...atributos, { nombre: "", valores: [] }], variantes)}
            className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {atributos.length === 0 ? "Agregar atributo" : "Agregar otro atributo"}
          </button>
        )}
      </div>

      {/* Reparto del stock al convertir */}
      {stockPorDistribuir !== undefined && variantes.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
            asignado === stockPorDistribuir
              ? "border-lime-500/30 bg-lime-500/10 text-lime-700 dark:text-lime-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
          )}
        >
          <span>
            Stock actual por distribuir: <strong className="tabular-nums">{stockPorDistribuir}</strong> · asignado{" "}
            <strong className="tabular-nums">{asignado}</strong>
            {asignado !== stockPorDistribuir &&
              (asignado < stockPorDistribuir ? ` · faltan ${stockPorDistribuir - asignado}` : ` · sobran ${asignado - stockPorDistribuir}`)}
          </span>
          <button
            type="button"
            onClick={() =>
              onChange(atributos, variantes.map((v, i) => ({ ...v, cantidadDisponible: i === 0 ? stockPorDistribuir : 0 })))
            }
            className="font-medium underline underline-offset-2"
          >
            Asignar todo a la primera
          </button>
        </div>
      )}

      {/* Combinaciones */}
      {variantes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-stone-200 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-stone-100/70 dark:bg-white/5 text-xs text-stone-500 dark:text-stone-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Variante</th>
                <th className="px-2 py-2 text-left font-medium">SKU</th>
                <th className="px-2 py-2 text-left font-medium">Precio</th>
                {manejaStock && <th className="px-2 py-2 text-left font-medium">Stock</th>}
                <th className="px-3 py-2 text-center font-medium">Activa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-white/10">
              {variantes.map((v, i) => (
                <tr key={claveVariante(v.valores, atributos)} className={cn(!v.activo && "opacity-60")}>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap">{nombreVariante(v.valores, atributos)}</td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={v.sku}
                      onChange={(e) => actualizarVariante(i, { sku: e.target.value })}
                      placeholder="—"
                      aria-label={`SKU de ${nombreVariante(v.valores, atributos)}`}
                      className="h-8 min-w-24 text-sm"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={v.precio ?? ""}
                      onChange={(e) => actualizarVariante(i, { precio: e.target.value === "" ? null : e.target.valueAsNumber })}
                      placeholder={formatear(precioBase)}
                      aria-label={`Precio de ${nombreVariante(v.valores, atributos)}`}
                      className="h-8 min-w-24 text-sm tabular-nums"
                    />
                  </td>
                  {manejaStock && (
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={v.cantidadDisponible}
                        onChange={(e) => actualizarVariante(i, { cantidadDisponible: Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber })}
                        aria-label={`Stock de ${nombreVariante(v.valores, atributos)}`}
                        className="h-8 w-20 text-sm tabular-nums"
                      />
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={v.activo}
                      onChange={(e) => actualizarVariante(i, { activo: e.target.checked })}
                      aria-label={`Variante ${nombreVariante(v.valores, atributos)} activa`}
                      className="h-4 w-4 accent-lime-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-stone-400 dark:text-stone-500">
        {variantes.length > MAX_VARIANTES
          ? `Máximo ${MAX_VARIANTES} variantes: reduce los valores.`
          : "Sin precio, la variante usa el precio del producto. Una variante que ya se vendió no se borra: al quitarla queda inactiva."}
      </p>
    </div>
  );
}

function FilaAtributo({
  atributo,
  onNombre,
  onValores,
  onQuitar,
}: {
  atributo: AtributoVariante;
  onNombre: (nombre: string) => void;
  onValores: (valores: string[]) => void;
  onQuitar: () => void;
}) {
  const [nuevo, setNuevo] = useState("");

  const agregar = () => {
    const valor = nuevo.trim();
    if (!valor) return;
    if (!atributo.valores.some((v) => v.trim().toLowerCase() === valor.toLowerCase())) onValores([...atributo.valores, valor]);
    setNuevo("");
  };

  return (
    <div className="space-y-2 rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-transparent p-3">
      <div className="flex items-center gap-2">
        <Input
          value={atributo.nombre}
          onChange={(e) => onNombre(e.target.value)}
          placeholder="Atributo (ej. Color de luz)"
          aria-label="Nombre del atributo"
          className="h-8 text-sm"
        />
        <button
          type="button"
          onClick={onQuitar}
          aria-label={`Quitar atributo ${atributo.nombre}`}
          className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-white/5 dark:hover:text-stone-200"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {atributo.valores.map((valor) => (
          <span
            key={valor}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 dark:border-white/15 bg-stone-50 dark:bg-white/5 px-2 py-0.5 text-xs"
          >
            {valor}
            <button
              type="button"
              onClick={() => onValores(atributo.valores.filter((v) => v !== valor))}
              aria-label={`Quitar ${valor}`}
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar();
              }
            }}
            placeholder="Nuevo valor"
            aria-label={`Nuevo valor de ${atributo.nombre || "atributo"}`}
            className="h-7 w-32 text-xs"
          />
          <button
            type="button"
            onClick={agregar}
            aria-label="Agregar valor"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 dark:border-white/10 text-stone-500 hover:bg-stone-100 dark:hover:bg-white/5"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
