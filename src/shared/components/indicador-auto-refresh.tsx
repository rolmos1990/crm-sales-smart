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
          "border border-border text-muted-foreground",
          "hover:bg-muted",
          className
        )}
        title={activo ? `Actualiza en ${restante}s` : "Auto-actualización pausada"}
      >
        <RefreshCw className={cn("h-3 w-3 shrink-0", activo && "animate-[spin_3s_linear_infinite]")} />
        {activo ? `${restante}s` : "Pausado"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2 bg-dropdown border-border">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1.5">
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
                  ? "bg-primary-muted text-primary"
                  : "text-text-secondary hover:bg-muted"
              )}
            >
              {o.etiqueta}
              {intervaloSegundos === o.valor && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
        <div className="h-px bg-border my-1.5" />
        <button
          type="button"
          onClick={() => {
            onToggleActivo();
            setAbierto(false);
          }}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-muted transition-colors"
        >
          {activo ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {activo ? "Pausar" : "Reanudar"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
