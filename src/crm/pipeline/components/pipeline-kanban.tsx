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
import { CalendarDays, Building2, TrendingUp, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cambiarEtapa } from "@/crm/oportunidades/actions";
import type { Oportunidad, Etapa } from "@/crm/oportunidades/types";
import { ETAPAS_PIPELINE, PROBABILIDADES_ETAPA } from "@/crm/oportunidades/types";
import { cn } from "@/lib/utils";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import { PanelOportunidad } from "@/crm/oportunidades/components/panel-oportunidad";
import { KanbanScrollContainer } from "./kanban-scroll-container";

const ETAPAS_ACTIVAS = ETAPAS_PIPELINE.filter(
  (e) => e.valor !== "GANADO" && e.valor !== "PERDIDO"
);

const formatearMoneda = (valor: number, moneda: string) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(valor);

// ── Tarjeta draggable ─────────────────────────────────────────────

function TarjetaOportunidad({
  oportunidad,
  onClick,
}: {
  oportunidad: Oportunidad;
  onClick: () => void;
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
    >
      <div
        className={cn(
          "cursor-pointer rounded-xl border bg-white dark:bg-white/6 dark:backdrop-blur-sm",
          "border-stone-200 dark:border-white/10",
          "hover:border-stone-300 dark:hover:border-white/20",
          "hover:shadow-md dark:hover:shadow-[0_4px_20px_-6px_rgba(0,0,0,0.5)]",
          "transition-all duration-150 group select-none p-4 space-y-3"
        )}
        onClick={onClick}
      >
        {/* Título + menú */}
        <div className="flex items-start justify-between gap-1.5">
          <span className="text-sm font-semibold leading-snug line-clamp-2 flex-1 text-stone-900 dark:text-stone-100 pointer-events-none">
            {oportunidad.titulo}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex size-6 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-stone-100 dark:hover:bg-white/10 transition-all outline-none flex-shrink-0 mt-0.5"
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
              >
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = `/crm/oportunidades/${oportunidad.id}`}>
                Ver completo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Valor */}
        <div className="text-lg font-bold text-lime-600 dark:text-lime-400 tabular-nums pointer-events-none">
          {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
        </div>

        {/* Meta */}
        <div className="space-y-1.5 pointer-events-none">
          {oportunidad.empresa && (
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              <Building2 className="h-3 w-3 shrink-0 text-stone-400 dark:text-stone-500" />
              <span className="truncate">{oportunidad.empresa.nombre}</span>
            </div>
          )}
          {oportunidad.fechaCierre && (
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              <CalendarDays className="h-3 w-3 shrink-0 text-stone-400 dark:text-stone-500" />
              {format(new Date(oportunidad.fechaCierre), "dd MMM", { locale: es })}
            </div>
          )}
        </div>

        {/* Barra de probabilidad */}
        <div className="flex items-center justify-between gap-3 pointer-events-none">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 tabular-nums">
            {oportunidad.probabilidad}%
          </span>
          <div className="flex-1 bg-stone-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-lime-500 dark:bg-lime-400 rounded-full h-1.5 transition-all"
              style={{ width: `${oportunidad.probabilidad}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Overlay visual durante el drag ────────────────────────────────

function TarjetaOverlay({ oportunidad }: { oportunidad: Oportunidad }) {
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

function ColumnaKanban({
  etapaConfig,
  items,
  onCardClick,
}: {
  etapaConfig: (typeof ETAPAS_ACTIVAS)[number];
  items: Oportunidad[];
  onCardClick: (op: Oportunidad) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapaConfig.valor });
  const totalValor = items.reduce((sum, o) => sum + o.valor, 0);

  return (
    <div className="flex-shrink-0 w-[280px]">
      <div
        className={cn(
          "flex flex-col rounded-2xl border transition-all",
          "bg-stone-100/60 dark:bg-white/4 dark:backdrop-blur-xl",
          "border-stone-200 dark:border-white/10",
          isOver && "ring-2 ring-lime-400/40 bg-lime-50 dark:bg-lime-400/5"
        )}
      >
        {/* Encabezado de columna */}
        <div className="px-3.5 pt-3.5 pb-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold",
                  etapaConfig.color
                )}
              >
                {etapaConfig.etiqueta}
              </span>
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-md bg-stone-200 dark:bg-white/10 text-xs font-bold text-stone-600 dark:text-stone-400">
                {items.length}
              </span>
            </div>
            <Link href={`/crm/oportunidades/nueva?etapa=${etapaConfig.valor}`}>
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
            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-stone-500 dark:text-stone-400">
              <TrendingUp className="h-3 w-3 text-lime-500 dark:text-lime-500" />
              <span className="text-lime-600 dark:text-lime-400 font-semibold">
                {formatearMoneda(totalValor, "PEN")}
              </span>
            </div>
          )}
        </div>

        {/* Área droppable con tarjetas */}
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div ref={setNodeRef} className="px-3 pb-3 min-h-[80px]">
            {items.length === 0 ? (
              <div
                className={cn(
                  "rounded-xl border-2 border-dashed py-10 text-center text-xs transition-colors",
                  isOver
                    ? "border-lime-400/50 bg-lime-500/5 text-lime-500 dark:text-lime-400 font-semibold"
                    : "border-stone-300 dark:border-white/10 text-stone-400 dark:text-stone-600"
                )}
              >
                {isOver ? "Soltar aquí" : "Sin oportunidades"}
              </div>
            ) : (
              items.map((op) => (
                <TarjetaOportunidad
                  key={op.id}
                  oportunidad={op}
                  onClick={() => onCardClick(op)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ── PipelineKanban principal ──────────────────────────────────────

interface PipelineKanbanProps {
  oportunidades: Map<Etapa, Oportunidad[]>;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
}

export function PipelineKanban({
  oportunidades,
  empresas,
  contactos,
}: PipelineKanbanProps) {
  const [localOps, setLocalOps] = useState<Map<Etapa, Oportunidad[]>>(oportunidades);
  const [selected, setSelected] = useState<Oportunidad | null>(null);
  const [activeCard, setActiveCard] = useState<Oportunidad | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveCard(active.data.current as Oportunidad);
  };

  const handleDragEnd = async ({ over, active }: DragEndEvent) => {
    setActiveCard(null);
    if (!over) return;

    const oportunidad = active.data.current as Oportunidad;
    const nuevaEtapa = over.id as Etapa;
    if (oportunidad.etapa === nuevaEtapa) return;

    // Actualización optimista inmediata
    setLocalOps((prev) => {
      const next = new Map(prev);
      next.set(
        oportunidad.etapa,
        (next.get(oportunidad.etapa) ?? []).filter((o) => o.id !== oportunidad.id)
      );
      next.set(nuevaEtapa, [
        { ...oportunidad, etapa: nuevaEtapa, probabilidad: PROBABILIDADES_ETAPA[nuevaEtapa] },
        ...(next.get(nuevaEtapa) ?? []),
      ]);
      return next;
    });

    const resultado = await cambiarEtapa(oportunidad.id, { etapa: nuevaEtapa });
    if (!resultado.exito) {
      toast.error(resultado.error);
      setLocalOps(oportunidades); // revert
    } else {
      toast.success(
        `Movido a ${ETAPAS_PIPELINE.find((e) => e.valor === nuevaEtapa)?.etiqueta}`
      );
    }
  };

  const handleUpdate = (updated: Oportunidad) => {
    setLocalOps((prev) => {
      const next = new Map(prev);
      for (const [etapa, ops] of next.entries()) {
        next.set(etapa, ops.filter((o) => o.id !== updated.id));
      }
      if (updated.etapa !== "GANADO" && updated.etapa !== "PERDIDO") {
        next.set(updated.etapa, [updated, ...(next.get(updated.etapa) ?? [])]);
      }
      return next;
    });
    setSelected(updated);
  };

  const handleDelete = (id: string) => {
    setLocalOps((prev) => {
      const next = new Map(prev);
      for (const [etapa, ops] of next.entries()) {
        next.set(etapa, ops.filter((o) => o.id !== id));
      }
      return next;
    });
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <KanbanScrollContainer
          stageColors={["#0ea5e9", "#8b5cf6", "#f59e0b", "#f97316"]}
        >
          {ETAPAS_ACTIVAS.map((etapaConfig) => (
            <ColumnaKanban
              key={etapaConfig.valor}
              etapaConfig={etapaConfig}
              items={localOps.get(etapaConfig.valor) ?? []}
              onCardClick={setSelected}
            />
          ))}
        </KanbanScrollContainer>

        <DragOverlay dropAnimation={{ duration: 150 }}>
          {activeCard && <TarjetaOverlay oportunidad={activeCard} />}
        </DragOverlay>
      </DndContext>

      <PanelOportunidad
        oportunidad={selected}
        empresas={empresas}
        contactos={contactos}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  );
}
