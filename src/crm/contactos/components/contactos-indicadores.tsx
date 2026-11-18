"use client";

import { Info, RefreshCw, ShoppingBag, Sprout, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Segmento } from "../segmentacion/condiciones";
import type { IndicadoresContactos } from "../types";

interface Tarjeta {
  segmento: Segmento;
  etiqueta: string;
  valor: number;
  Icono: LucideIcon;
  acento: string;
}

function porcentaje(valor: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((valor / total) * 100)}% del total`;
}

/**
 * 041 — Cinco indicadores compactos. Son botones: seleccionar uno filtra la
 * tabla (comparten estado con las pestañas). Sin tendencias "vs. mes
 * anterior": no hay historial real del que sacarlas (FR-005, DT-03).
 */
export function ContactosIndicadores({
  indicadores,
  segmento,
  onSeleccionar,
}: {
  indicadores: IndicadoresContactos;
  segmento: Segmento;
  onSeleccionar: (segmento: Segmento) => void;
}) {
  const { total } = indicadores;
  const tarjetas: Tarjeta[] = [
    { segmento: "TODOS", etiqueta: "Total contactos", valor: total, Icono: Users, acento: "text-muted-foreground bg-muted" },
    { segmento: "CLIENTES", etiqueta: "Clientes", valor: indicadores.clientes, Icono: ShoppingBag, acento: "text-primary bg-primary-muted" },
    { segmento: "INTERESADOS", etiqueta: "Interesados", valor: indicadores.interesados, Icono: TrendingUp, acento: "text-stage-amber-text bg-stage-amber-muted" },
    { segmento: "POR_RECUPERAR", etiqueta: "Por recuperar", valor: indicadores.porRecuperar, Icono: RefreshCw, acento: "text-stage-cyan-text bg-stage-cyan-muted" },
    { segmento: "LEADS", etiqueta: "Leads", valor: indicadores.leads, Icono: Sprout, acento: "text-stage-purple-text bg-stage-purple-muted" },
  ];

  return (
    <div data-slot="contactos-indicadores" className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tarjetas.map((t) => {
          const activa = segmento === t.segmento;
          return (
            <button
              key={t.segmento}
              type="button"
              aria-pressed={activa}
              onClick={() => onSeleccionar(t.segmento)}
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors outline-none",
                "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50",
                activa ? "border-primary/60 bg-primary-muted/40" : "border-border-subtle",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", t.acento)}>
                <t.Icono className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs text-muted-foreground">{t.etiqueta}</span>
                <span className="block text-xl leading-tight font-semibold tracking-tight text-foreground tabular-nums">
                  {t.valor.toLocaleString("es")}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {t.segmento === "TODOS" ? "Toda la cartera" : porcentaje(t.valor, total)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <Tooltip>
        <TooltipTrigger className="inline-flex w-fit items-center gap-1 text-[11px] text-muted-foreground cursor-default">
          <Info className="size-3" aria-hidden />
          Las categorías pueden superponerse
        </TooltipTrigger>
        <TooltipContent>
          Un cliente que vuelve a mostrar interés cuenta en Clientes y también en Interesados, así que los números no tienen por qué sumar el total.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
