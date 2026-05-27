"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Building2, Plus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { moverAStage } from "../actions";
import { cn } from "@/lib/utils";
import type { PipelineConStages, PipelineStage, OportunidadEnStage } from "../types";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import { PanelOportunidadDinamico } from "@/crm/oportunidades/components/panel-oportunidad-dinamico";
import type { Oportunidad } from "@/crm/oportunidades/types";
import { KanbanScrollContainer } from "./kanban-scroll-container";

const formatearMoneda = (valor: number, moneda: string) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(valor);

// ── Tarjeta draggable ─────────────────────────────────────────────

function TarjetaOportunidad({
  oportunidad,
  stageColor,
  onCardClick,
}: {
  oportunidad: OportunidadEnStage;
  stageColor: string;
  onCardClick: (op: OportunidadEnStage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: oportunidad.id,
    data: oportunidad,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("mb-2.5 touch-none", isDragging && "opacity-25")}
      {...attributes}
      {...listeners}
      onClick={() => onCardClick(oportunidad)}
    >
      <div
        className={cn(
          "block cursor-pointer rounded-xl border",
          "bg-white dark:bg-white/6 dark:backdrop-blur-sm",
          "border-stone-200 dark:border-white/10",
          "hover:border-stone-300 dark:hover:border-white/20",
          "hover:shadow-md dark:hover:shadow-[0_4px_20px_-6px_rgba(0,0,0,0.5)]",
          "transition-all duration-150 select-none p-4 space-y-3"
        )}
      >
        <div
          className="h-0.5 rounded-full -mt-1 mb-2 opacity-60"
          style={{ backgroundColor: stageColor }}
        />

        <p className="text-sm font-semibold leading-snug line-clamp-2 text-stone-900 dark:text-stone-100">
          {oportunidad.titulo}
        </p>

        <div className="text-lg font-bold tabular-nums" style={{ color: stageColor }}>
          {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
        </div>

        <div className="space-y-1.5">
          {oportunidad.empresa && (
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{oportunidad.empresa.nombre}</span>
            </div>
          )}
          {oportunidad.fechaCierre && (
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              <CalendarDays className="h-3 w-3 shrink-0" />
              {format(new Date(oportunidad.fechaCierre), "dd MMM", { locale: es })}
            </div>
          )}
        </div>

        {/* Etiquetas */}
        {oportunidad.tags && oportunidad.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {oportunidad.tags.slice(0, 3).map(({ tagId, tag }) => (
              <span
                key={tagId}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border"
                style={tag.color ? {
                  backgroundColor: `${tag.color}20`,
                  borderColor: `${tag.color}40`,
                  color: tag.color,
                } : {
                  backgroundColor: "rgba(0,0,0,0.05)",
                  borderColor: "rgba(0,0,0,0.1)",
                  color: "#78716c",
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color ?? "#a8a29e" }} />
                {tag.nombre}
              </span>
            ))}
            {oportunidad.tags.length > 3 && (
              <span className="text-[10px] text-stone-400 dark:text-stone-500 self-center">
                +{oportunidad.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 tabular-nums">
            {oportunidad.probabilidad}%
          </span>
          <div className="flex-1 bg-stone-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div
              className="rounded-full h-1.5 transition-all"
              style={{
                width: `${oportunidad.probabilidad}%`,
                backgroundColor: stageColor,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TarjetaOverlay({ oportunidad }: { oportunidad: OportunidadEnStage }) {
  return (
    <div className="w-[280px] rotate-1 rounded-xl border-2 border-lime-400/30 bg-white dark:bg-stone-900 shadow-2xl p-4 space-y-2 opacity-95">
      <p className="text-sm font-semibold line-clamp-1 text-stone-900 dark:text-stone-100">
        {oportunidad.titulo}
      </p>
      <p className="text-lg font-bold text-lime-600 dark:text-lime-400 tabular-nums">
        {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
      </p>
      {oportunidad.empresa && (
        <p className="text-xs text-stone-500 dark:text-stone-400">{oportunidad.empresa.nombre}</p>
      )}
    </div>
  );
}

// ── Columna droppable ─────────────────────────────────────────────

function ColumnaStage({
  stage,
  items,
  pipelineId,
  onCardClick,
}: {
  stage: PipelineStage;
  items: OportunidadEnStage[];
  pipelineId: string;
  onCardClick: (op: OportunidadEnStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const totalValor = items.reduce((sum, o) => sum + o.valor, 0);
  const color = stage.color ?? "#818cf8";

  return (
    <div className="flex-shrink-0 w-[280px]">
      <div
        className={cn(
          "flex flex-col rounded-2xl border overflow-hidden transition-all",
          "bg-stone-100/60 dark:bg-white/4 dark:backdrop-blur-xl",
          "border-stone-200 dark:border-white/10",
          isOver && "ring-2 ring-offset-1 dark:ring-offset-stone-950"
        )}
        style={isOver ? { "--tw-ring-color": `${color}40` } as React.CSSProperties : undefined}
      >
        <div
          className="h-[3px] flex-shrink-0"
          style={{ backgroundColor: color }}
        />

        <div className="px-3.5 pt-3 pb-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold border"
                style={{
                  backgroundColor: `${color}18`,
                  color: color,
                  borderColor: `${color}35`,
                }}
              >
                {stage.nombre}
              </span>
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-md bg-stone-200 dark:bg-white/10 text-xs font-bold text-stone-600 dark:text-stone-400">
                {items.length}
              </span>
            </div>
            <Link
              href={`/crm/oportunidades/nueva?pipelineId=${pipelineId}&stageId=${stage.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-lg text-stone-400 dark:text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200 dark:hover:bg-white/10"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium">
              <TrendingUp className="h-3 w-3" style={{ color }} />
              <span className="font-semibold" style={{ color }}>
                {formatearMoneda(totalValor, "PEN")}
              </span>
            </div>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-300px)]">
          <div ref={setNodeRef} className="px-3 pb-3 min-h-[80px]">
            {items.length === 0 ? (
              <div
                className={cn(
                  "rounded-xl border-2 border-dashed py-10 text-center text-xs transition-colors",
                  isOver ? "font-semibold" : "border-stone-300 dark:border-white/10 text-stone-400 dark:text-stone-600"
                )}
                style={isOver ? { borderColor: `${color}50`, color, backgroundColor: `${color}08` } : undefined}
              >
                {isOver ? "Soltar aquí" : "Sin oportunidades"}
              </div>
            ) : (
              items.map((op) => (
                <TarjetaOportunidad
                  key={op.id}
                  oportunidad={op}
                  stageColor={color}
                  onCardClick={onCardClick}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ── Kanban principal ──────────────────────────────────────────────

interface PipelineKanbanDinamicoProps {
  pipeline: PipelineConStages;
  oportunidadesPorStage: Map<string, OportunidadEnStage[]>;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
}

export function PipelineKanbanDinamico({
  pipeline,
  oportunidadesPorStage,
  empresas,
  contactos,
}: PipelineKanbanDinamicoProps) {
  const [localOps, setLocalOps] = useState(oportunidadesPorStage);
  const [activeCard, setActiveCard] = useState<OportunidadEnStage | null>(null);
  const [selected, setSelected] = useState<{ id: string; stageId: string | null } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveCard(active.data.current as OportunidadEnStage);
  };

  const handleDragEnd = async ({ over, active }: DragEndEvent) => {
    setActiveCard(null);
    if (!over) return;

    const oportunidad = active.data.current as OportunidadEnStage;
    const nuevoStageId = over.id as string;
    if (oportunidad.stageId === nuevoStageId) return;

    const nuevoStage = pipeline.stages.find((s) => s.id === nuevoStageId);

    setLocalOps((prev) => {
      const next = new Map(prev);
      const anteriorKey = oportunidad.stageId ?? "__sin_stage__";
      next.set(anteriorKey, (next.get(anteriorKey) ?? []).filter((o) => o.id !== oportunidad.id));
      next.set(nuevoStageId, [
        {
          ...oportunidad,
          stageId: nuevoStageId,
          pipelineId: pipeline.id,
          probabilidad: nuevoStage?.probabilidad ?? oportunidad.probabilidad,
        },
        ...(next.get(nuevoStageId) ?? []),
      ]);
      return next;
    });

    const resultado = await moverAStage(oportunidad.id, nuevoStageId, pipeline.id);
    if (!resultado.exito) {
      toast.error(resultado.error);
      setLocalOps(oportunidadesPorStage);
    } else {
      const stage = pipeline.stages.find((s) => s.id === nuevoStageId);
      toast.success(`Movido a "${stage?.nombre ?? nuevoStageId}"`);
    }
  };

  const handleUpdate = (updated: Oportunidad & { stageId?: string | null }) => {
    if (updated.stageId === undefined) return;
    setLocalOps((prev) => {
      const next = new Map(prev);
      let tagsExistentes: OportunidadEnStage["tags"] = [];
      for (const ops of next.values()) {
        const found = ops.find((o) => o.id === updated.id);
        if (found) { tagsExistentes = found.tags; break; }
      }
      for (const [key, ops] of next) {
        next.set(key, ops.filter((o) => o.id !== updated.id));
      }
      const targetStage = updated.stageId ?? "__sin_stage__";
      next.set(targetStage, [
        {
          id: updated.id,
          titulo: updated.titulo,
          valor: updated.valor,
          moneda: updated.moneda,
          probabilidad: updated.probabilidad ?? 0,
          fechaCierre: updated.fechaCierre,
          stageId: updated.stageId ?? null,
          pipelineId: updated.pipelineId ?? pipeline.id,
          empresa: updated.empresa,
          tags: updated.tags ?? tagsExistentes,
        },
        ...(next.get(targetStage) ?? []),
      ]);
      return next;
    });
  };

  const handleDelete = (id: string) => {
    setLocalOps((prev) => {
      const next = new Map(prev);
      for (const [key, ops] of next) {
        next.set(key, ops.filter((o) => o.id !== id));
      }
      return next;
    });
    setSelected(null);
  };

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <KanbanScrollContainer
          stageColors={pipeline.stages.map((s) => s.color ?? "#818cf8")}
        >
          {pipeline.stages.map((stage) => (
            <ColumnaStage
              key={stage.id}
              stage={stage}
              pipelineId={pipeline.id}
              items={localOps.get(stage.id) ?? []}
              onCardClick={(op) => setSelected({ id: op.id, stageId: op.stageId ?? null })}
            />
          ))}
        </KanbanScrollContainer>

        <DragOverlay dropAnimation={{ duration: 150 }}>
          {activeCard && <TarjetaOverlay oportunidad={activeCard} />}
        </DragOverlay>
      </DndContext>

      <PanelOportunidadDinamico
        oportunidadId={selected?.id ?? null}
        initialStageId={selected?.stageId ?? null}
        pipeline={pipeline}
        empresas={empresas}
        contactos={contactos}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  );
}
