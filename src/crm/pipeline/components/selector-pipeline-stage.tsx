"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown, Loader2, ArrowRightLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { obtenerPipelinesAction } from "@/crm/pipeline/actions";
import type { PipelineConStages } from "@/crm/pipeline/types";

interface SelectorPipelineStageProps {
  pipelineId: string | null;
  stageId: string | null;
  stageNombre?: string | null;
  stageColor?: string | null;
  onSelect: (stageId: string, pipelineId: string, stageNombre: string, stageColor: string | null) => void;
  disabled?: boolean;
  cargando?: boolean;
}

export function SelectorPipelineStage({
  pipelineId,
  stageId,
  stageNombre,
  stageColor,
  onSelect,
  disabled,
  cargando,
}: SelectorPipelineStageProps) {
  const [open, setOpen] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineConStages[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);

  useEffect(() => {
    if (open && pipelines.length === 0) {
      setLoadingPipelines(true);
      obtenerPipelinesAction().then((data) => {
        setPipelines(data as PipelineConStages[]);
        setLoadingPipelines(false);
      });
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled || cargando}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-all",
          "border-border",
          "bg-input-bg text-foreground",
          "hover:bg-muted hover:border-border-strong",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {cargando ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <>
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: stageColor ?? "var(--text-muted)" }}
            />
            <span className="max-w-[120px] truncate">{stageNombre ?? "Sin etapa"}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-0.5" />
          </>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[264px] p-0 border-border bg-dropdown shadow-2xl rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-border-subtle flex items-center gap-2">
          <div className="rounded-md bg-muted p-1 flex-shrink-0">
            <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-xs font-semibold text-foreground">
            Mover a etapa
          </span>
        </div>

        {/* Lista de pipelines y stages */}
        <div className="max-h-[360px] overflow-y-auto py-1.5">
          {loadingPipelines ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cargando pipelines...</span>
            </div>
          ) : pipelines.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No hay pipelines disponibles</p>
          ) : (
            <div className="px-1.5">
              {pipelines.map((pipeline, idx) => (
                <div key={pipeline.id}>
                  {/* Encabezado de pipeline */}
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 pb-1",
                      idx === 0 ? "pt-2" : "pt-3 mt-0.5 border-t border-border-subtle",
                    )}
                  >
                    <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
                      {pipeline.nombre}
                    </span>
                    {pipeline.id === pipelineId && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-primary-muted text-primary border border-primary-border flex-shrink-0">
                        Actual
                      </span>
                    )}
                  </div>

                  {/* Etapas del pipeline */}
                  <div className="space-y-0.5 pb-1">
                    {pipeline.stages.map((stage) => {
                      const esCurrent = stage.id === stageId && pipeline.id === pipelineId;
                      const color = stage.color ?? "var(--text-muted)";

                      return (
                        <button
                          key={stage.id}
                          onClick={() => {
                            if (!esCurrent) {
                              onSelect(stage.id, pipeline.id, stage.nombre, stage.color ?? null);
                              setOpen(false);
                            }
                          }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-left group",
                            esCurrent
                              ? "bg-primary-muted cursor-default"
                              : "hover:bg-muted cursor-pointer active:scale-[0.98]",
                          )}
                        >
                          {/* Punto de color de la etapa */}
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full flex-shrink-0 transition-transform",
                              !esCurrent && "group-hover:scale-125",
                            )}
                            style={{ backgroundColor: color }}
                          />

                          {/* Nombre */}
                          <span
                            className={cn(
                              "flex-1 text-sm truncate",
                              esCurrent
                                ? "font-semibold text-primary"
                                : "text-foreground",
                            )}
                          >
                            {stage.nombre}
                          </span>

                          {/* Check si es actual, probabilidad si no */}
                          {esCurrent ? (
                            <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          ) : (
                            <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              {stage.probabilidad}%
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
