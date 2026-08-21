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
import { CalendarDays, Building2, MoreHorizontal, Plus } from "lucide-react";
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
  puedeMod = true,
}: {
  oportunidad: Oportunidad;
  onClick: () => void;
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
    >
      <div
        className={cn(
          "cursor-pointer rounded-xl border group select-none",
          "bg-card",
          "border-card-border",
          "hover:border-border-strong",
          "hover:shadow-sm dark:hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.7)]",
          "transition-all duration-150 p-3.5 space-y-2.5"
        )}
        onClick={onClick}
      >
        {/* Título + menú */}
        <div className="flex items-start justify-between gap-1.5">
          <span className="text-[13px] font-semibold leading-snug line-clamp-2 flex-1 text-foreground pointer-events-none">
            {oportunidad.titulo}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex size-5 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all outline-none flex-shrink-0 mt-0.5"
            >
              <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
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
        <div className="text-base font-bold text-primary tabular-nums pointer-events-none">
          {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
        </div>

        {/* Meta */}
        <div className="space-y-1 pointer-events-none">
          {oportunidad.empresa && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{oportunidad.empresa.nombre}</span>
            </div>
          )}
          {oportunidad.fechaCierre && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarDays className="h-3 w-3 shrink-0" />
              {format(new Date(oportunidad.fechaCierre), "dd MMM", { locale: es })}
            </div>
          )}
        </div>

        {/* Etiquetas */}
        {oportunidad.tags && oportunidad.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pointer-events-none">
            {oportunidad.tags.slice(0, 3).map(({ tagId, tag }) => (
              <span
                key={tagId}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  !tag.color && "bg-badge-bg text-badge-text"
                )}
                style={tag.color ? {
                  backgroundColor: `${tag.color}18`,
                  color: tag.color,
                } : undefined}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", !tag.color && "bg-badge-text")}
                  style={tag.color ? { backgroundColor: tag.color } : undefined}
                />
                {tag.nombre}
              </span>
            ))}
            {oportunidad.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{oportunidad.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Barra de probabilidad */}
        <div className="flex items-center gap-2.5 pointer-events-none">
          <div className="flex-1 bg-muted rounded-full h-1 overflow-hidden">
            <div
              className="bg-primary rounded-full h-1 transition-all"
              style={{ width: `${oportunidad.probabilidad}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground tabular-nums w-7 text-right">
            {oportunidad.probabilidad}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Overlay visual durante el drag ────────────────────────────────

function TarjetaOverlay({ oportunidad }: { oportunidad: Oportunidad }) {
  return (
    <div className="w-[272px] rotate-[1.5deg] rounded-xl border border-primary/20 bg-card shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] p-3.5 space-y-2">
      <p className="text-[13px] font-semibold line-clamp-1 text-foreground">
        {oportunidad.titulo}
      </p>
      <p className="text-base font-bold text-primary tabular-nums">
        {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
      </p>
      {oportunidad.empresa && (
        <p className="text-[11px] text-muted-foreground">{oportunidad.empresa.nombre}</p>
      )}
    </div>
  );
}

// ── Columna droppable ─────────────────────────────────────────────

function ColumnaKanban({
  etapaConfig,
  items,
  onCardClick,
  puedeMod = true,
}: {
  etapaConfig: (typeof ETAPAS_ACTIVAS)[number];
  items: Oportunidad[];
  onCardClick: (op: Oportunidad) => void;
  puedeMod?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapaConfig.valor });
  const totalValor = items.reduce((sum, o) => sum + o.valor, 0);

  return (
    <div className="flex-shrink-0 w-[272px]" data-testid="pipeline-column">
      <div
        className={cn(
          "flex flex-col rounded-xl border transition-all duration-150",
          "bg-column-bg",
          "border-column-border",
          isOver && "ring-1 ring-primary/30 bg-primary-muted/60"
        )}
      >
        {/* Encabezado de columna */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
                  etapaConfig.color
                )}
              >
                {etapaConfig.etiqueta}
              </span>
              <span className="inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 rounded bg-badge-bg text-[10px] font-bold text-badge-text">
                {items.length}
              </span>
            </div>
            {puedeMod && (
              <Link href={`/crm/oportunidades/nueva?etapa=${etapaConfig.valor}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>
          {items.length > 0 && (
            <p className="mt-1.5 text-[11px] font-semibold text-primary tabular-nums" data-testid="column-total">
              {formatearMoneda(totalValor, "PEN")}
            </p>
          )}
        </div>

        {/* Área droppable con tarjetas */}
        <ScrollArea className="h-[calc(100vh-290px)]">
          <div ref={setNodeRef} className="px-2.5 pb-2.5 min-h-[80px]">
            {items.length === 0 ? (
              <div
                className={cn(
                  "rounded-lg border border-dashed py-8 text-center text-[11px] transition-all",
                  isOver
                    ? "border-primary/40 bg-primary-muted text-primary font-medium"
                    : "border-border text-muted-foreground"
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

// ── PipelineKanban principal ──────────────────────────────────────

interface PipelineKanbanProps {
  oportunidades: Map<Etapa, Oportunidad[]>;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  defaultCountryCode?: string;
  puedeMod?: boolean;
}

export function PipelineKanban({
  oportunidades,
  empresas,
  contactos,
  defaultCountryCode = "PA",
  puedeMod = true,
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
    if (!puedeMod || !over) return;

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
      let tagsExistentes: Oportunidad["tags"] = [];
      for (const ops of next.values()) {
        const found = ops.find((o) => o.id === updated.id);
        if (found) { tagsExistentes = found.tags; break; }
      }
      for (const [etapa, ops] of next.entries()) {
        next.set(etapa, ops.filter((o) => o.id !== updated.id));
      }
      if (updated.etapa !== "GANADO" && updated.etapa !== "PERDIDO") {
        next.set(updated.etapa, [{ ...updated, tags: updated.tags ?? tagsExistentes }, ...(next.get(updated.etapa) ?? [])]);
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
              puedeMod={puedeMod}
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
        defaultCountryCode={defaultCountryCode}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  );
}
