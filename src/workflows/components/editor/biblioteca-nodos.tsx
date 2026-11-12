"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Info, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CATALOGO_NODOS, type CategoriaNodo } from "../../definicion/catalogo-nodos";
import type { TipoNodo } from "../../definicion/schema";
import { ESTILO_CATEGORIA } from "../estilos";
import { ICONOS_NODO } from "./iconos";

export const TIPO_ARRASTRE = "application/x-karia-nodo";

const ORDEN_CATEGORIAS: CategoriaNodo[] = ["CONVERSACION", "CONTROL", "CRM", "IA"];

// Inicio es único y ya viene en todo Workflow: no se ofrece en la biblioteca.
const TIPOS_DISPONIBLES = (Object.keys(CATALOGO_NODOS) as TipoNodo[]).filter((t) => t !== "INICIO");

export function BibliotecaNodos({ onAgregar }: { onAgregar: (tipo: TipoNodo) => void }) {
  const [filtro, setFiltro] = useState("");
  const [colapsadas, setColapsadas] = useState<Set<CategoriaNodo>>(new Set());
  const buscador = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K enfoca el buscador sin sacar al usuario del lienzo.
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      buscador.current?.focus();
      buscador.current?.select();
    };
    window.addEventListener("keydown", manejar);
    return () => window.removeEventListener("keydown", manejar);
  }, []);

  const q = filtro.trim().toLowerCase();

  const grupos = useMemo(
    () =>
      ORDEN_CATEGORIAS.map((categoria) => ({
        categoria,
        tipos: TIPOS_DISPONIBLES.filter((t) => {
          const d = CATALOGO_NODOS[t];
          return (
            d.categoria === categoria &&
            (!q || d.etiqueta.toLowerCase().includes(q) || d.descripcion.toLowerCase().includes(q))
          );
        }),
      })).filter((g) => g.tipos.length > 0),
    [q],
  );

  const alternar = (categoria: CategoriaNodo) =>
    setColapsadas((previas) => {
      const siguiente = new Set(previas);
      if (!siguiente.delete(categoria)) siguiente.add(categoria);
      return siguiente;
    });

  return (
    <div className="flex h-full flex-col" data-slot="biblioteca-nodos">
      <div className="space-y-2.5 border-b border-border px-3 py-3">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-foreground">Componentes</p>
          <Tooltip>
            <TooltipTrigger
              render={<span tabIndex={0} className="text-text-tertiary hover:text-foreground" />}
              aria-label="Cómo usar los componentes"
            >
              <Info className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent>Arrastra un componente al lienzo o haz clic para agregarlo.</TooltipContent>
          </Tooltip>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <Input
            ref={buscador}
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar componente…"
            className="h-8 pl-8 pr-12 text-sm"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-badge-bg px-1 py-0.5 font-sans text-[10px] font-medium text-text-tertiary lg:block">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {grupos.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Ningún componente coincide con “{filtro}”.</p>
        )}

        {grupos.map(({ categoria, tipos }) => {
          const estilo = ESTILO_CATEGORIA[categoria];
          const IconoCategoria = ICONOS_NODO[estilo.iconoCategoria];
          // Al buscar siempre se muestran los resultados, aunque el grupo esté colapsado.
          const abierta = !!q || !colapsadas.has(categoria);

          return (
            <section key={categoria} className="rounded-lg border border-border bg-surface-2/40">
              <button
                type="button"
                onClick={() => alternar(categoria)}
                aria-expanded={abierta}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-card-hover"
              >
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border", estilo.chip)}>
                  {IconoCategoria && <IconoCategoria className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{estilo.etiqueta}</span>
                  <span className="block truncate text-[11px] text-text-tertiary">{estilo.descripcion}</span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200",
                    !abierta && "-rotate-90",
                  )}
                />
              </button>

              {abierta && (
                <ul className="space-y-1 p-1.5 pt-0">
                  {tipos.map((tipo) => {
                    const d = CATALOGO_NODOS[tipo];
                    const Icono = ICONOS_NODO[d.icono];
                    return (
                      <li key={tipo}>
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(TIPO_ARRASTRE, tipo);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={() => onAgregar(tipo)}
                          title={`${d.descripcion}\nArrástralo al lienzo o haz clic para agregarlo.`}
                          className="flex w-full cursor-grab items-start gap-2.5 rounded-lg border border-transparent bg-card p-2 text-left transition-colors hover:border-border-default hover:bg-card-hover active:cursor-grabbing"
                        >
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                              estilo.chip,
                            )}
                          >
                            {Icono && <Icono className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-foreground">{d.etiqueta}</span>
                            <span className="line-clamp-2 block text-[11px] leading-snug text-text-tertiary">
                              {d.descripcion}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
