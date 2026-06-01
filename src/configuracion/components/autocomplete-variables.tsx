"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  filterVariables,
  CATEGORY_LABELS,
  type VariableDefinition,
  type VariableCategory,
} from "@/configuracion/plantillas/variable-defs";

interface AutocompleteVariablesProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (variable: VariableDefinition) => void;
  onClose: () => void;
}

export function AutocompleteVariables({
  query,
  position,
  onSelect,
  onClose,
}: AutocompleteVariablesProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => filterVariables(query), [query]);
  const activeVar = results[activeIndex] ?? null;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex >= results.length && results.length > 0) {
      setActiveIndex(results.length - 1);
    }
  }, [results.length, activeIndex]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-ac-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex((i) => Math.min(results.length - 1, i + 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex((i) => Math.max(0, i - 1));
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          e.stopPropagation();
          if (activeVar) onSelect(activeVar);
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    };
    document.addEventListener("keydown", handle, { capture: true });
    return () => document.removeEventListener("keydown", handle, { capture: true });
  }, [results.length, activeVar, onSelect, onClose]);

  if (results.length === 0) return null;

  // Group by category preserving order
  const grouped: { category: VariableCategory; vars: VariableDefinition[] }[] = [];
  for (const v of results) {
    const last = grouped[grouped.length - 1];
    if (last?.category === v.category) {
      last.vars.push(v);
    } else {
      grouped.push({ category: v.category as VariableCategory, vars: [v] });
    }
  }

  return (
    <div
      className="fixed z-[9999] w-72 max-h-72 rounded-xl border border-white/10 bg-stone-950/98 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Hint */}
      <div className="px-3 py-1.5 border-b border-white/5 shrink-0">
        <p className="text-[10px] text-stone-500">
          {query ? `"${query}"` : "Variables disponibles — escribe para filtrar"}
        </p>
      </div>

      {/* Results */}
      <div ref={listRef} className="overflow-y-auto flex-1">
        {grouped.map(({ category, vars }) => (
          <div key={category}>
            <div className="px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-stone-500 sticky top-0 bg-stone-950/98 z-10">
              {CATEGORY_LABELS[category]}
            </div>
            {vars.map((v) => {
              const idx = results.indexOf(v);
              return (
                <button
                  key={v.key}
                  type="button"
                  data-ac-idx={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => onSelect(v)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all border-l-2",
                    idx === activeIndex
                      ? "bg-lime-500/10 border-lime-500/50"
                      : "border-transparent hover:bg-white/5"
                  )}
                >
                  <span className="text-base shrink-0 leading-none">{v.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-100">{v.label}</p>
                    <p className="text-[10px] text-stone-500 truncate">{v.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
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
