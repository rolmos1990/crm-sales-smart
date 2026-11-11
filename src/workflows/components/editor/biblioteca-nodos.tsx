"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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

  const grupos = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return ORDEN_CATEGORIAS.map((categoria) => ({
      categoria,
      tipos: TIPOS_DISPONIBLES.filter((t) => {
        const d = CATALOGO_NODOS[t];
        return d.categoria === categoria && (!q || d.etiqueta.toLowerCase().includes(q) || d.descripcion.toLowerCase().includes(q));
      }),
    })).filter((g) => g.tipos.length > 0);
  }, [filtro]);

  return (
    <div className="flex h-full flex-col" data-slot="biblioteca-nodos">
      <div className="border-b border-border p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Componentes</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar…" className="h-8 pl-8 text-sm" />
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {grupos.map(({ categoria, tipos }) => (
          <section key={categoria}>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {ESTILO_CATEGORIA[categoria].etiqueta}
            </p>
            <ul className="space-y-1.5">
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
                      className="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-border bg-card p-2 text-left transition-colors hover:bg-card-hover active:cursor-grabbing"
                    >
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border", ESTILO_CATEGORIA[categoria].chip)}>
                        {Icono && <Icono className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{d.etiqueta}</span>
                        <span className="line-clamp-1 block text-[11px] text-muted-foreground">{d.descripcion}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
