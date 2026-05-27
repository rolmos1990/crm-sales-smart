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
  onSelect: (stageId: string, pipelineId: string) => void;
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
          "border-stone-200 dark:border-white/10",
          "bg-white dark:bg-white/5 text-stone-600 dark:text-stone-300",
          "hover:bg-stone-50 dark:hover:bg-white/8 hover:border-stone-300 dark:hover:border-white/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {cargando ? (
          <Loader2 className="h-3 w-3 animate-spin text-stone-400" />
        ) : (
          <>
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: stageColor ?? "#94a3b8" }}
            />
            <span className="max-w-[120px] truncate">{stageNombre ?? "Sin etapa"}</span>
            <ChevronDown className="h-3 w-3 text-stone-400 flex-shrink-0 ml-0.5" />
          </>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[264px] p-0 border-stone-200 dark:border-white/10 bg-white dark:bg-stone-900 shadow-2xl rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-stone-100 dark:border-white/8 flex items-center gap-2">
          <div className="rounded-md bg-stone-100 dark:bg-white/8 p-1 flex-shrink-0">
            <ArrowRightLeft className="h-3 w-3 text-stone-500 dark:text-stone-400" />
          </div>
          <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">
            Mover a etapa
          </span>
        </div>

        {/* Lista de pipelines y stages */}
        <div className="max-h-[360px] overflow-y-auto py-1.5">
          {loadingPipelines ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
              <span className="text-xs text-stone-400">Cargando pipelines...</span>
            </div>
          ) : pipelines.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-6">No hay pipelines disponibles</p>
          ) : (
            <div className="px-1.5">
              {pipelines.map((pipeline, idx) => (
                <div key={pipeline.id}>
                  {/* Encabezado de pipeline */}
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 pb-1",
                      idx === 0 ? "pt-2" : "pt-3 mt-0.5 border-t border-stone-100 dark:border-white/6",
                    )}
                  >
                    <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 truncate">
                      {pipeline.nombre}
                    </span>
                    {pipeline.id === pipelineId && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-lime-500/10 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400 border border-lime-500/20 dark:border-lime-400/20 flex-shrink-0">
                        Actual
                      </span>
                    )}
                  </div>

                  {/* Etapas del pipeline */}
                  <div className="space-y-0.5 pb-1">
                    {pipeline.stages.map((stage) => {
                      const esCurrent = stage.id === stageId && pipeline.id === pipelineId;
                      const color = stage.color ?? "#94a3b8";

                      return (
                        <button
                          key={stage.id}
                          onClick={() => {
                            if (!esCurrent) {
                              onSelect(stage.id, pipeline.id);
                              setOpen(false);
                            }
                          }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-left group",
                            esCurrent
                              ? "bg-lime-500/10 dark:bg-lime-400/10 cursor-default"
                              : "hover:bg-stone-50 dark:hover:bg-white/5 cursor-pointer active:scale-[0.98]",
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
                                ? "font-semibold text-lime-700 dark:text-lime-400"
                                : "text-stone-700 dark:text-stone-300",
                            )}
                          >
                            {stage.nombre}
                          </span>

                          {/* Check si es actual, probabilidad si no */}
                          {esCurrent ? (
                            <Check className="h-3.5 w-3.5 text-lime-600 dark:text-lime-400 flex-shrink-0" />
                          ) : (
                            <span className="text-[10px] tabular-nums text-stone-400 dark:text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
