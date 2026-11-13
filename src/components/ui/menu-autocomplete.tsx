"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Cáscara presentacional + manejo de teclado de un menú anclado al cursor.
// Extraída de autocomplete-variables.tsx (que ahora la consume) para que el
// menú de referencias `@` no duplique el mismo markup y los mismos atajos.
// No sabe nada de variables ni de referencias: recibe items ya filtrados.

export interface ItemAutocomplete {
  /** Identificador único dentro de la lista. */
  id: string;
  /** Encabezado del grupo bajo el que se muestra. */
  grupo: string;
  icono: string;
  etiqueta: string;
  detalle: string;
}

interface MenuAutocompleteProps<T extends ItemAutocomplete> {
  items: T[];
  /** Texto escrito después del disparador — solo se muestra en la cabecera. */
  consulta: string;
  /** Coordenadas de viewport: el menú se posiciona `fixed`. */
  posicion: { top: number; left: number };
  /** Mensaje de la cabecera cuando todavía no se escribió nada. */
  ayuda: string;
  onSeleccionar: (item: T) => void;
  onCerrar: () => void;
}

export const ANCHO_MENU_AUTOCOMPLETE = 288; // w-72
export const ALTO_MENU_AUTOCOMPLETE = 288; // max-h-72

export function MenuAutocomplete<T extends ItemAutocomplete>({
  items,
  consulta,
  posicion,
  ayuda,
  onSeleccionar,
  onCerrar,
}: MenuAutocompleteProps<T>) {
  const [indiceActivo, setIndiceActivo] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);

  const itemActivo = items[indiceActivo] ?? null;

  useEffect(() => {
    setIndiceActivo(0);
  }, [consulta]);

  useEffect(() => {
    if (indiceActivo >= items.length && items.length > 0) {
      setIndiceActivo(items.length - 1);
    }
  }, [items.length, indiceActivo]);

  useEffect(() => {
    const el = listaRef.current?.querySelector(`[data-ac-idx="${indiceActivo}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [indiceActivo]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setIndiceActivo((i) => Math.min(items.length - 1, i + 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setIndiceActivo((i) => Math.max(0, i - 1));
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          e.stopPropagation();
          if (itemActivo) onSeleccionar(itemActivo);
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onCerrar();
          break;
      }
    };
    document.addEventListener("keydown", handle, { capture: true });
    return () => document.removeEventListener("keydown", handle, { capture: true });
  }, [items.length, itemActivo, onSeleccionar, onCerrar]);

  if (items.length === 0) return null;

  // Agrupa preservando el orden de `items`.
  const grupos: { grupo: string; items: T[] }[] = [];
  for (const item of items) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.grupo === item.grupo) ultimo.items.push(item);
    else grupos.push({ grupo: item.grupo, items: [item] });
  }

  return (
    <div
      className="fixed z-[9999] w-72 max-h-72 rounded-xl border border-white/10 bg-stone-950/98 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
      style={{ top: posicion.top, left: posicion.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1.5 border-b border-white/5 shrink-0">
        <p className="text-[10px] text-stone-500">{consulta ? `"${consulta}"` : ayuda}</p>
      </div>

      <div ref={listaRef} className="overflow-y-auto flex-1">
        {grupos.map(({ grupo, items: delGrupo }) => (
          <div key={grupo}>
            <div className="px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-stone-500 sticky top-0 bg-stone-950/98 z-10">
              {grupo}
            </div>
            {delGrupo.map((item) => {
              const idx = items.indexOf(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  data-ac-idx={idx}
                  onMouseEnter={() => setIndiceActivo(idx)}
                  onClick={() => onSeleccionar(item)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all border-l-2",
                    idx === indiceActivo
                      ? "bg-lime-500/10 border-lime-500/50"
                      : "border-transparent hover:bg-white/5",
                  )}
                >
                  <span className="text-base shrink-0 leading-none">{item.icono}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-100">{item.etiqueta}</p>
                    <p className="text-[10px] text-stone-500 truncate">{item.detalle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 px-3 py-1.5 flex gap-3 text-[10px] text-stone-500 shrink-0">
        <span>
          <kbd className="px-1 py-px bg-white/5 border border-white/10 rounded font-mono text-stone-400">↑↓</kbd>{" "}
          Navegar
        </span>
        <span>
          <kbd className="px-1 py-px bg-white/5 border border-white/10 rounded font-mono text-stone-400">Enter</kbd>{" "}
          Insertar
        </span>
        <span>
          <kbd className="px-1 py-px bg-white/5 border border-white/10 rounded font-mono text-stone-400">Esc</kbd>{" "}
          Cerrar
        </span>
      </div>
    </div>
  );
}
