"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MensajeReaccionResumen } from "../types";

// ── Constantes ────────────────────────────────────────────────────────────────

const EMOJIS_RAPIDOS = ["😀", "❤️", "👍"];

// Exportado para reutilizarse también en el selector de emojis del composer
// (input-mensaje.tsx) — mismo set curado, sin duplicar la lista.
export const EMOJIS_GRID = [
  "😀", "😃", "😄", "😁", "😆", "😂", "🤣",
  "😊", "😍", "❤️", "👍", "👎", "🔥", "🎉",
  "😮", "😢", "😡", "🙏", "💯", "🚀", "👏",
];

const REACCIONES_CRM = [
  { emoji: "📌", label: "Importante" },
  { emoji: "💰", label: "Venta" },
  { emoji: "⚠️", label: "Seguimiento" },
  { emoji: "🔥", label: "Prioridad Alta" },
  { emoji: "🎯", label: "Oportunidad" },
];

// ── Barra de acciones rápidas en hover ───────────────────────────────────────

interface BarraAccionesRapidasProps {
  mensajeId: string;
  visible: boolean;
  esPropioONota: boolean;
  onReaccion: (emoji: string, tipo: "CANAL" | "INTERNA") => void;
  onAbrirSelector: () => void;
}

export function BarraAccionesRapidas({
  visible,
  esPropioONota,
  onReaccion,
  onAbrirSelector,
}: BarraAccionesRapidasProps) {
  return (
    <div
      className={cn(
        "absolute -top-9 z-20 flex items-center gap-0.5 px-1.5 py-1",
        "bg-dropdown backdrop-blur-sm border border-border rounded-full shadow-xl",
        "transition-all duration-150",
        esPropioONota ? "right-0" : "left-0",
        visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
      )}
    >
      {EMOJIS_RAPIDOS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReaccion(emoji, "CANAL")}
          className="h-7 w-7 rounded-full flex items-center justify-center text-base hover:bg-muted hover:scale-110 active:scale-95 transition-all"
        >
          {emoji}
        </button>
      ))}
      <div className="w-px h-4 bg-border mx-0.5" />
      <button
        type="button"
        onClick={onAbrirSelector}
        className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        title="Más reacciones"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        title="Más acciones"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Selector de reacciones completo (popover) ─────────────────────────────────

interface SelectorReaccionesCompletoProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onReaccion: (emoji: string, tipo: "CANAL" | "INTERNA") => void;
  esPropioONota: boolean;
}

export function SelectorReaccionesCompleto({
  open,
  onOpenChange,
  onReaccion,
  esPropioONota,
}: SelectorReaccionesCompletoProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {/* Trigger invisible posicionado correctamente */}
      <PopoverTrigger
        className={cn(
          "absolute -top-9 z-10 h-7 w-7 opacity-0 pointer-events-none",
          esPropioONota ? "right-9" : "left-9"
        )}
      />
      <PopoverContent
        className="w-64 p-3 bg-dropdown border-border shadow-2xl"
        side="top"
        align={esPropioONota ? "end" : "start"}
      >
        {/* Sección emojis */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Emojis
          </p>
          <div className="grid grid-cols-7 gap-0.5">
            {EMOJIS_GRID.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReaccion(emoji, "CANAL")}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-lg hover:bg-muted hover:scale-110 active:scale-95 transition-all"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border my-2.5" />

        {/* Sección CRM */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Reacciones CRM (internas)
          </p>
          <div className="space-y-0.5">
            {REACCIONES_CRM.map(({ emoji, label }) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReaccion(emoji, "INTERNA")}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <span className="text-base leading-none">{emoji}</span>
                <span className="text-xs text-text-secondary">{label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-stage-amber/60" />
            Las reacciones internas no se envían al canal
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Badges de reacciones debajo del mensaje ───────────────────────────────────

interface GrupoReaccion {
  emoji: string;
  count: number;
  nombres: string[];
  esPropio: boolean;
  tipo: "CANAL" | "INTERNA";
}

function agruparReacciones(
  reacciones: MensajeReaccionResumen[],
  usuarioActualId: string | null
): GrupoReaccion[] {
  const grupos = new Map<string, GrupoReaccion>();
  for (const r of reacciones) {
    const g = grupos.get(r.emoji) ?? {
      emoji: r.emoji,
      count: 0,
      nombres: [],
      esPropio: false,
      tipo: r.tipo,
    };
    g.count++;
    if (r.nombreUsuario) g.nombres.push(r.nombreUsuario);
    if (usuarioActualId && r.usuarioId === usuarioActualId) g.esPropio = true;
    grupos.set(r.emoji, g);
  }
  return [...grupos.values()];
}

interface BadgesReaccionesProps {
  reacciones: MensajeReaccionResumen[];
  usuarioActualId: string | null;
  onToggle: (emoji: string) => void;
}

export function BadgesReacciones({
  reacciones,
  usuarioActualId,
  onToggle,
}: BadgesReaccionesProps) {
  const grupos = agruparReacciones(reacciones, usuarioActualId);
  if (grupos.length === 0) return null;

  return (
    <TooltipProvider delay={300}>
      <div className="flex flex-wrap gap-1">
        {grupos.map((g) => (
          <Tooltip key={g.emoji}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => onToggle(g.emoji)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                    "transition-all hover:scale-105 active:scale-95",
                    g.tipo === "INTERNA"
                      ? "bg-stage-amber-muted border-stage-amber-border text-stage-amber-text hover:bg-stage-amber-muted/70"
                      : g.esPropio
                        ? "bg-primary-muted border-primary-border text-primary hover:bg-primary-muted/70"
                        : "bg-badge-bg border-badge-border text-badge-text hover:bg-muted"
                  )}
                >
                  <span className="leading-none">{g.emoji}</span>
                  {g.count > 1 && (
                    <span className="font-medium tabular-nums">{g.count}</span>
                  )}
                </button>
              }
            />
            <TooltipContent
              side="top"
              className="max-w-[180px] text-center text-xs"
            >
              {/* Sin token de color propio — hereda `text-background` del
                  TooltipContent (bg-foreground), que ya invierte correctamente
                  entre light/dark; solo se ajusta peso/opacidad acá. */}
              {g.tipo === "INTERNA" && (
                <p className="font-semibold mb-0.5">Reacción interna CRM</p>
              )}
              {g.nombres.length > 0 ? (
                <p>{g.nombres.join(", ")}</p>
              ) : (
                <p className="opacity-70">Sin datos</p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
