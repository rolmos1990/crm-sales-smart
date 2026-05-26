"use client";

import { useState } from "react";
import { ArrowRightLeft, Check, ChevronDown, Loader2, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cambiarEtapa } from "../actions";
import { moverAStage, obtenerPipelinesAction } from "@/crm/pipeline/actions";
import { ETAPAS_PIPELINE } from "../types";
import type { Etapa } from "../types";
import type { PipelineConStages } from "@/crm/pipeline/types";
import { cn } from "@/lib/utils";

interface MoverPipelinePopoverProps {
  oportunidadId: string;
  etapaActual: Etapa;
  onMovidoEtapa: (nuevaEtapa: Etapa) => void;
}

export function MoverPipelinePopover({
  oportunidadId,
  etapaActual,
  onMovidoEtapa,
}: MoverPipelinePopoverProps) {
  const [open, setOpen] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineConStages[]>([]);
  const [cargandoPipelines, setCargandoPipelines] = useState(false);
  const [moviendo, setMoviendo] = useState<string | null>(null);

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && pipelines.length === 0 && !cargandoPipelines) {
      setCargandoPipelines(true);
      try {
        const datos = await obtenerPipelinesAction();
        setPipelines(datos as unknown as PipelineConStages[]);
      } finally {
        setCargandoPipelines(false);
      }
    }
  };

  const moverEtapa = async (etapa: Etapa) => {
    if (etapa === etapaActual || moviendo) return;
    setMoviendo(etapa);
    const resultado = await cambiarEtapa(oportunidadId, { etapa });
    setMoviendo(null);
    if (resultado.exito) {
      const etapaConfig = ETAPAS_PIPELINE.find((e) => e.valor === etapa);
      toast.success(`Movido a ${etapaConfig?.etiqueta ?? etapa}`);
      onMovidoEtapa(etapa);
      setOpen(false);
    } else {
      toast.error(resultado.error);
    }
  };

  const moverStage = async (stageId: string, pipelineId: string, nombre: string) => {
    if (moviendo) return;
    setMoviendo(stageId);
    const resultado = await moverAStage(oportunidadId, stageId, pipelineId);
    setMoviendo(null);
    if (resultado.exito) {
      toast.success(`Asignado a ${nombre}`);
      setOpen(false);
    } else {
      toast.error(resultado.error);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
          "border border-stone-200 dark:border-white/10",
          "bg-white dark:bg-white/5 text-stone-500 dark:text-stone-400",
          "hover:bg-stone-50 dark:hover:bg-white/8 hover:text-stone-700 dark:hover:text-stone-200",
          "hover:border-stone-300 dark:hover:border-white/20",
          "shadow-sm hover:shadow cursor-pointer",
        )}
      >
        <ArrowRightLeft className="h-3 w-3" />
        Mover a
        <ChevronDown className="h-3 w-3 opacity-50" />
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          "w-64 p-0 rounded-2xl overflow-hidden",
          "border border-stone-200 dark:border-white/10",
          "bg-white dark:bg-stone-900",
          "shadow-[0_20px_60px_-10px_rgba(0,0,0,0.25)]",
        )}
        align="start"
        side="bottom"
        sideOffset={6}
      >
        <ScrollArea className="max-h-[360px]">
          <div className="p-2 space-y-0.5">
            {/* Header */}
            <div className="flex items-center gap-2 px-2 py-2 mb-1">
              <div className="flex items-center justify-center h-5 w-5 rounded-md bg-lime-500/10 dark:bg-lime-400/10">
                <Layers className="h-3 w-3 text-lime-600 dark:text-lime-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                Mover oportunidad
              </span>
            </div>

            {/* Etapas clásicas */}
            <SectionLabel label="Etapas clásicas" />
            {ETAPAS_PIPELINE.map((e) => {
              const isActual = e.valor === etapaActual;
              const isBusy = moviendo === e.valor;
              return (
                <EtapaButton
                  key={e.valor}
                  label={e.etiqueta}
                  colorClass={e.color}
                  isActual={isActual}
                  isBusy={isBusy}
                  disabled={!!moviendo}
                  onClick={() => moverEtapa(e.valor)}
                />
              );
            })}

            {/* Pipelines dinámicos */}
            {cargandoPipelines && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
              </div>
            )}

            {pipelines.map((pipeline) => (
              <div key={pipeline.id}>
                <div className="h-px bg-stone-100 dark:bg-white/8 mx-2 my-2" />
                <SectionLabel label={pipeline.nombre} />
                {pipeline.stages.map((stage) => {
                  const isBusy = moviendo === stage.id;
                  const hex = stage.color ?? "#94a3b8";
                  return (
                    <StageButton
                      key={stage.id}
                      label={stage.nombre}
                      color={hex}
                      isBusy={isBusy}
                      disabled={!!moviendo}
                      onClick={() => moverStage(stage.id, pipeline.id, stage.nombre)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-600">
      {label}
    </p>
  );
}

function EtapaButton({
  label,
  colorClass,
  isActual,
  isBusy,
  disabled,
  onClick,
}: {
  label: string;
  colorClass: string;
  isActual: boolean;
  isBusy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-sm transition-all",
        "disabled:pointer-events-none",
        isActual
          ? "bg-stone-50 dark:bg-white/8"
          : "hover:bg-stone-50 dark:hover:bg-white/5 cursor-pointer",
      )}
    >
      <span className={cn("inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold", colorClass)}>
        {label}
      </span>
      <span className="flex-1" />
      {isBusy && <Loader2 className="h-3 w-3 animate-spin text-stone-400 dark:text-stone-500" />}
      {isActual && !isBusy && <Check className="h-3 w-3 text-lime-500 dark:text-lime-400" />}
    </button>
  );
}

function StageButton({
  label,
  color,
  isBusy,
  disabled,
  onClick,
}: {
  label: string;
  color: string;
  isBusy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const bg = `${color}22`;
  const text = color;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-sm transition-all",
        "hover:bg-stone-50 dark:hover:bg-white/5 cursor-pointer",
        "disabled:pointer-events-none",
      )}
    >
      <span
        className="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold"
        style={{ backgroundColor: bg, color: text, border: `1px solid ${color}33` }}
      >
        {label}
      </span>
      <span className="flex-1" />
      {isBusy && <Loader2 className="h-3 w-3 animate-spin text-stone-400 dark:text-stone-500" />}
    </button>
  );
}
