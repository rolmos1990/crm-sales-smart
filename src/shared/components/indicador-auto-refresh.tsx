"use client";

import { useState } from "react";
import { RefreshCw, Pause, Play, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OPCIONES_INTERVALO_REFRESH, type IntervaloRefresh } from "@/shared/hooks/use-auto-refresh";

interface IndicadorAutoRefreshProps {
  restante: number;
  intervaloSegundos: IntervaloRefresh;
  activo: boolean;
  onCambiarIntervalo: (segundos: IntervaloRefresh) => void;
  onToggleActivo: () => void;
  className?: string;
}

/** Contador regresivo + selector de intervalo, reutilizado en Pipeline e Inbox. */
export function IndicadorAutoRefresh({
  restante,
  intervaloSegundos,
  activo,
  onCambiarIntervalo,
  onToggleActivo,
  className,
}: IndicadorAutoRefreshProps) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        className={cn(
          "flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-medium tabular-nums transition-colors",
          "border border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-400",
          "hover:bg-stone-100 dark:hover:bg-white/5",
          className
        )}
        title={activo ? `Actualiza en ${restante}s` : "Auto-actualización pausada"}
      >
        <RefreshCw className={cn("h-3 w-3 shrink-0", activo && "animate-[spin_3s_linear_infinite]")} />
        {activo ? `${restante}s` : "Pausado"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2 bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 px-1 mb-1.5">
          Actualizar cada
        </p>
        <div className="space-y-0.5">
          {OPCIONES_INTERVALO_REFRESH.map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => {
                onCambiarIntervalo(o.valor);
                setAbierto(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-left transition-colors",
                intervaloSegundos === o.valor
                  ? "bg-lime-500/10 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400"
                  : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5"
              )}
            >
              {o.etiqueta}
              {intervaloSegundos === o.valor && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
        <div className="h-px bg-stone-100 dark:bg-white/10 my-1.5" />
        <button
          type="button"
          onClick={() => {
            onToggleActivo();
            setAbierto(false);
          }}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors"
        >
          {activo ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {activo ? "Pausar" : "Reanudar"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
