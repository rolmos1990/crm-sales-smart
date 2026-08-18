"use client";

import { useState, useEffect } from "react";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Building2, Plus, User } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useMoverAStageMutation } from "@/crm/oportunidades/hooks";
import { cn } from "@/lib/utils";
import type { PipelineConStages, PipelineStage, OportunidadEnStage } from "../types";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import { WorkspaceOportunidad } from "@/crm/oportunidades/components/workspace-oportunidad";
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
  puedeMod = true,
}: {
  oportunidad: OportunidadEnStage;
  stageColor: string;
  onCardClick: (op: OportunidadEnStage) => void;
  puedeMod?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: oportunidad.id,
    data: oportunidad,
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="oportunidad-card"
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("mb-2 touch-none", isDragging && "opacity-20")}
      {...(puedeMod ? attributes : {})}
      {...(puedeMod ? listeners : {})}
      onClick={() => onCardClick(oportunidad)}
    >
      <div
        className={cn(
          "block cursor-pointer rounded-xl border select-none",
          "bg-white dark:bg-[oklch(0.130_0.004_264)]",
          "border-stone-200/80 dark:border-white/[0.07]",
          "shadow-sm dark:shadow-[0_2px_10px_-6px_rgba(0,0,0,0.55)]",
          "hover:border-stone-300 dark:hover:border-white/[0.13]",
          "hover:shadow-sm dark:hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.7)]",
          "transition-all duration-150 p-3.5 space-y-3"
        )}
      >
        {/* Indicador de etapa — línea fina, color desaturado, sin resplandor */}
        <div
          className="h-[2px] rounded-full -mt-0.5 mb-0.5"
          style={{ backgroundColor: stageColor, opacity: 0.5 }}
        />

        {/* Identidad: qué pide el cliente (título) + quién es (contacto / empresa) */}
        <div className="space-y-1.5">
          <p className="text-[14px] font-semibold leading-snug line-clamp-2 text-stone-900 dark:text-white/90">
            {oportunidad.titulo}
          </p>
          {(oportunidad.contacto || oportunidad.empresa) && (
            <div className="space-y-0.5">
              {oportunidad.contacto && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <User className="h-3 w-3 shrink-0 text-stone-400 dark:text-white/30" />
                  <span className="text-[12px] text-stone-500 dark:text-white/40 truncate">
                    {oportunidad.contacto.nombre} {oportunidad.contacto.apellido}
                  </span>
                </div>
              )}
              {oportunidad.empresa && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building2 className="h-3 w-3 shrink-0 text-stone-400 dark:text-white/30" />
                  <span className="text-[12px] text-stone-500 dark:text-white/40 truncate">
                    {oportunidad.empresa.nombre}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Separador sutil entre identidad e información comercial */}
        <div className="border-t border-stone-100 dark:border-white/[0.05]" />

        {/* Monto (izquierda) + vencimiento (derecha, cápsula neutral) */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold tabular-nums text-stone-900 dark:text-white/90">
            {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
          </span>
          {oportunidad.fechaCierre && (
            <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 dark:border-white/[0.08] bg-stone-50 dark:bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] font-medium text-stone-500 dark:text-white/40 shrink-0">
              <CalendarDays className="h-3 w-3 shrink-0" />
              Vence {format(new Date(oportunidad.fechaCierre), "dd MMM", { locale: es })}
            </span>
          )}
        </div>

        {/* Etiquetas — diseño neutral, sin límite de cantidad */}
        {oportunidad.tags && oportunidad.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {oportunidad.tags.map(({ tagId, tag }) => (
              <span
                key={tagId}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 dark:border-white/[0.08] bg-stone-100/80 dark:bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:text-white/50"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color ?? "#78716c", opacity: 0.75 }}
                />
                {tag.nombre}
              </span>
            ))}
          </div>
        )}

        {/* Progreso — relleno del color de etapa desaturado, sin resplandor */}
        <div className="flex items-center gap-2.5">
          <div className="flex-1 bg-stone-100 dark:bg-white/[0.07] rounded-full h-1 overflow-hidden">
            <div
              className="rounded-full h-1 transition-all"
              style={{ width: `${oportunidad.probabilidad}%`, backgroundColor: stageColor, opacity: 0.55 }}
            />
          </div>
          <span className="text-[10px] font-medium text-stone-400 dark:text-white/30 tabular-nums w-7 text-right">
            {oportunidad.probabilidad}%
          </span>
          {oportunidad.nuevoMensaje && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80 dark:bg-emerald-400/70 shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaOverlay({ oportunidad }: { oportunidad: OportunidadEnStage }) {
  return (
    <div className="w-[272px] rotate-[1.5deg] rounded-xl border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[oklch(0.155_0.004_264)] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] p-3.5 space-y-2">
      <p className="text-[14px] font-semibold line-clamp-1 text-stone-900 dark:text-white/90">
        {oportunidad.titulo}
      </p>
      <p className="text-[15px] font-semibold text-stone-900 dark:text-white/90 tabular-nums">
        {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
      </p>
      {oportunidad.contacto && (
        <p className="text-[12px] text-stone-500 dark:text-white/40">
          {oportunidad.contacto.nombre} {oportunidad.contacto.apellido}
        </p>
      )}
      {oportunidad.empresa && (
        <p className="text-[12px] text-stone-500 dark:text-white/40">{oportunidad.empresa.nombre}</p>
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
  puedeMod = true,
}: {
  stage: PipelineStage;
  items: OportunidadEnStage[];
  pipelineId: string;
  onCardClick: (op: OportunidadEnStage) => void;
  puedeMod?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const totalValor = items.reduce((sum, o) => sum + o.valor, 0);
  const color = stage.color ?? "#818cf8";

  return (
    <div className="flex-shrink-0 w-[272px]" data-testid="pipeline-column">
      <div
        className={cn(
          "flex flex-col rounded-xl border overflow-hidden transition-all duration-150",
          "bg-stone-100/50 dark:bg-[oklch(0.095_0.003_264)]",
          "border-stone-200/70 dark:border-white/[0.06]",
          isOver && "ring-1 dark:ring-offset-[oklch(0.063_0.002_264)]"
        )}
        style={isOver ? { "--tw-ring-color": `${color}30` } as React.CSSProperties : undefined}
      >
        {/* Línea de color del stage */}
        <div className="h-[2px] flex-shrink-0 opacity-70" style={{ backgroundColor: color }} />

        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: `${color}15`,
                  color: color,
                }}
              >
                {stage.nombre}
              </span>
              <span className="inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 rounded bg-stone-200 dark:bg-white/[0.08] text-[10px] font-bold text-stone-500 dark:text-white/40">
                {items.length}
              </span>
            </div>
            {puedeMod && (
              <Link
                href={`/crm/oportunidades/nueva?pipelineId=${pipelineId}&stageId=${stage.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-md text-stone-400 dark:text-white/30 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-white/[0.08]"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>

          {items.length > 0 && (
            <p className="mt-1.5 text-[11px] font-semibold tabular-nums" style={{ color, opacity: 0.85 }} data-testid="column-total">
              {formatearMoneda(totalValor, "PEN")}
            </p>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-290px)]">
          <div ref={setNodeRef} className="px-2.5 pb-2.5 min-h-[80px]">
            {items.length === 0 ? (
              <div
                className={cn(
                  "rounded-lg border border-dashed py-8 text-center text-[11px] transition-all",
                  isOver ? "font-medium" : "border-stone-300/60 dark:border-white/[0.06] text-stone-400 dark:text-white/20"
                )}
                style={isOver ? { borderColor: `${color}40`, color, backgroundColor: `${color}06` } : undefined}
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
                  puedeMod={puedeMod}
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
  defaultCountryCode?: string;
  puedeMod?: boolean;
}

export function PipelineKanbanDinamico({
  pipeline,
  oportunidadesPorStage,
  empresas,
  contactos,
  defaultCountryCode = "PA",
  puedeMod = true,
}: PipelineKanbanDinamicoProps) {
  const [localOps, setLocalOps] = useState(oportunidadesPorStage);
  const [activeCard, setActiveCard] = useState<OportunidadEnStage | null>(null);
  const [selected, setSelected] = useState<{ id: string; stageId: string | null } | null>(null);
  const moverMutation = useMoverAStageMutation();

  // Resincroniza con los datos frescos del servidor (ej. tras el auto-refresh
  // periódico, que trae nuevoMensaje/oportunidades actualizadas) — pero nunca
  // mientras hay un drag en curso, para no pisar el estado optimista a mitad
  // de un movimiento.
  useEffect(() => {
    if (!activeCard) setLocalOps(oportunidadesPorStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oportunidadesPorStage]);

  // Las etapas Ganado/Perdido con visible=false no se muestran como columna,
  // pero la oportunidad se sigue pudiendo mover ahí (drag a otra vía o popover "Mover a").
  const stagesColumnas = pipeline.stages.filter((s) => !(s.esGanado || s.esPerdido) || s.visible);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveCard(active.data.current as OportunidadEnStage);
  };

  const handleDragEnd = ({ over, active }: DragEndEvent) => {
    setActiveCard(null);
    if (!puedeMod || !over) return;

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
          nuevoMensaje: oportunidad.nuevoMensaje,
        },
        ...(next.get(nuevoStageId) ?? []),
      ]);
      return next;
    });

    moverMutation.mutate(
      { oportunidadId: oportunidad.id, nuevoStageId, pipelineId: pipeline.id },
      {
        onError: (err) => {
          toast.error(err.message ?? "Error al mover la oportunidad");
          setLocalOps(oportunidadesPorStage);
        },
        onSuccess: () => {
          const stage = pipeline.stages.find((s) => s.id === nuevoStageId);
          toast.success(`Movido a "${stage?.nombre ?? nuevoStageId}"`);
        },
      },
    );
  };

  const handleUpdate = (updated: Oportunidad & { stageId?: string | null }) => {
    if (updated.stageId === undefined) return;
    setLocalOps((prev) => {
      const next = new Map(prev);
      let tagsExistentes: OportunidadEnStage["tags"] = [];
      let contactoExistente: OportunidadEnStage["contacto"] = null;
      for (const ops of next.values()) {
        const found = ops.find((o) => o.id === updated.id);
        if (found) { tagsExistentes = found.tags; contactoExistente = found.contacto; break; }
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
          nuevoMensaje: false,
          empresa: updated.empresa,
          contacto: updated.contactos?.[0]?.contacto ?? contactoExistente,
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
          stageColors={stagesColumnas.map((s) => s.color ?? "#818cf8")}
        >
          {stagesColumnas.map((stage) => (
            <ColumnaStage
              key={stage.id}
              stage={stage}
              pipelineId={pipeline.id}
              items={localOps.get(stage.id) ?? []}
              onCardClick={(op) => setSelected({ id: op.id, stageId: op.stageId ?? null })}
              puedeMod={puedeMod}
            />
          ))}
        </KanbanScrollContainer>

        <DragOverlay dropAnimation={{ duration: 150 }}>
          {activeCard && <TarjetaOverlay oportunidad={activeCard} />}
        </DragOverlay>
      </DndContext>

      <WorkspaceOportunidad
        oportunidadId={selected?.id ?? null}
        initialStageId={selected?.stageId ?? null}
        pipeline={pipeline}
        empresas={empresas}
        contactos={contactos}
        defaultCountryCode={defaultCountryCode}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  );
}
