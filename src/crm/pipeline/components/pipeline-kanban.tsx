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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cambiarEtapa } from "@/crm/oportunidades/actions";
import type { Oportunidad, Etapa } from "@/crm/oportunidades/types";
import { ETAPAS_PIPELINE } from "@/crm/oportunidades/types";
import { cn } from "@/lib/utils";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import { PanelOportunidad } from "@/crm/oportunidades/components/panel-oportunidad";

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
      className={cn("mb-2 touch-none", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      <Card
        className="cursor-pointer border hover:shadow-md transition-all group select-none"
        onClick={onClick}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-1">
            <span className="text-sm font-medium leading-tight line-clamp-2 flex-1 pointer-events-none">
              {oportunidad.titulo}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex size-6 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all outline-none flex-shrink-0"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
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
                <DropdownMenuItem asChild>
                  <Link href={`/crm/oportunidades/${oportunidad.id}`}>
                    Ver completo
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="text-base font-semibold text-primary tabular-nums pointer-events-none">
            {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
          </div>

          <div className="space-y-1 pointer-events-none">
            {oportunidad.empresa && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{oportunidad.empresa.nombre}</span>
              </div>
            )}
            {oportunidad.fechaCierre && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3 shrink-0" />
                {format(new Date(oportunidad.fechaCierre), "dd MMM", { locale: es })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pointer-events-none">
            <span className="text-xs text-muted-foreground">{oportunidad.probabilidad}%</span>
            <div className="w-16 bg-muted rounded-full h-1.5">
              <div
                className="bg-primary rounded-full h-1.5 transition-all"
                style={{ width: `${oportunidad.probabilidad}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Overlay visual durante el drag ────────────────────────────────

function TarjetaOverlay({ oportunidad }: { oportunidad: Oportunidad }) {
  return (
    <Card className="w-[272px] rotate-1 shadow-2xl border-2 border-primary/20 opacity-95">
      <CardContent className="p-3 space-y-1">
        <p className="text-sm font-medium line-clamp-1">{oportunidad.titulo}</p>
        <p className="text-sm font-semibold text-primary">
          {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
        </p>
        {oportunidad.empresa && (
          <p className="text-xs text-muted-foreground">{oportunidad.empresa.nombre}</p>
        )}
      </CardContent>
    </Card>
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
    <div className="flex-shrink-0 w-[272px]">
      <div
        className={cn(
          "flex flex-col rounded-xl border bg-card transition-all",
          isOver && "ring-2 ring-primary/40 bg-primary/5"
        )}
      >
        {/* Encabezado de columna */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  etapaConfig.color
                )}
              >
                {etapaConfig.etiqueta}
              </span>
              <Badge variant="secondary" className="text-xs h-5">
                {items.length}
              </Badge>
            </div>
            <Link href={`/crm/oportunidades/nueva?etapa=${etapaConfig.valor}`}>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              {formatearMoneda(totalValor, "PEN")}
            </div>
          )}
        </div>

        {/* Área droppable con tarjetas */}
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div ref={setNodeRef} className="px-3 pb-3 min-h-[80px]">
            {items.length === 0 ? (
              <div
                className={cn(
                  "rounded-lg border-2 border-dashed py-8 text-center text-xs text-muted-foreground transition-colors",
                  isOver
                    ? "border-primary/50 bg-primary/5 text-primary font-medium"
                    : "border-muted"
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
        { ...oportunidad, etapa: nuevaEtapa },
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
      // Si pasa a GANADO o PERDIDO, la tarjeta desaparece del kanban
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
        <div className="flex gap-3 overflow-x-auto pb-4">
          {ETAPAS_ACTIVAS.map((etapaConfig) => (
            <ColumnaKanban
              key={etapaConfig.valor}
              etapaConfig={etapaConfig}
              items={localOps.get(etapaConfig.valor) ?? []}
              onCardClick={setSelected}
            />
          ))}
        </div>

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
