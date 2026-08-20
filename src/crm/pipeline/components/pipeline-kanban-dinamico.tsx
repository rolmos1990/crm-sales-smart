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
import { CalendarDays, Building2, Plus, User, Receipt, Trophy, XCircle } from "lucide-react";
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

  // La posición (translate) va por style inline — dnd-kit la recalcula en cada
  // frame del drag para que la tarjeta siga al cursor 1:1 — por eso el scale
  // se aplica en el mismo transform (una utilidad de Tailwind no se puede
  // combinar con un transform inline, uno pisa al otro) pero SIN transition
  // en `transform`: animar esa propiedad mientras se actualiza en cada frame
  // metería un delay perceptible entre el cursor y la tarjeta. Solo la
  // opacidad se anima — eso alcanza para transmitir "se está arrastrando"
  // sin deformar nada ni introducir lag.
  const translate = CSS.Translate.toString(transform);
  const dragTransform = isDragging && translate ? `${translate} scale(0.97)` : translate;

  return (
    <div
      ref={setNodeRef}
      data-testid="oportunidad-card"
      style={{ transform: dragTransform }}
      className={cn(
        "mb-2 touch-none transition-opacity duration-150 ease-out",
        isDragging && "opacity-60"
      )}
      {...(puedeMod ? attributes : {})}
      {...(puedeMod ? listeners : {})}
      onClick={() => onCardClick(oportunidad)}
    >
      <div
        className={cn(
          "block cursor-pointer rounded-xl border select-none",
          "bg-white dark:bg-[oklch(0.130_0.004_264)]",
          "shadow-sm dark:shadow-[0_2px_10px_-6px_rgba(0,0,0,0.55)]",
          "hover:shadow-sm dark:hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.7)]",
          "transition-all duration-150 p-3.5 space-y-3"
        )}
        style={{ borderColor: `${stageColor}35` }}
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
    // Sin rotación — solo un scale leve (reducción) + opacidad, para que se
    // lea como "levantada del tablero" sin verse deformada. El transform acá
    // es puramente cosmético (escala): el posicionamiento real sobre el
    // cursor lo maneja el propio DragOverlay de dnd-kit por fuera de este nodo.
    <div className="w-[272px] scale-[0.97] opacity-95 rounded-xl border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[oklch(0.155_0.004_264)] shadow-[0_16px_32px_-10px_rgba(0,0,0,0.5)] p-3.5 space-y-2">
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
  total,
  pipelineId,
  onCardClick,
  puedeMod = true,
}: {
  stage: PipelineStage;
  items: OportunidadEnStage[];
  total: number;
  pipelineId: string;
  onCardClick: (op: OportunidadEnStage) => void;
  puedeMod?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
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

          <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" data-testid="column-total">
            <Receipt className="h-3 w-3 shrink-0 text-stone-400 dark:text-white/25" />
            <span className="text-stone-400 dark:text-white/30 font-medium">Total</span>
            <span className="font-semibold tabular-nums text-stone-600 dark:text-white/60">
              {formatearMoneda(total, "PEN")}
            </span>
          </div>
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

// ── Zonas rápidas Ganado/Perdido ────────────────────────────────────
// Ids centinela (no ids de etapa reales) — evita choques con el droppable de
// la columna real cuando esa etapa también está visible en el tablero (ej.
// con "Ver ocultos" activo). handleDragEnd los resuelve al id real.
const ZONA_GANADO_ID = "__zona_ganado__";
const ZONA_PERDIDO_ID = "__zona_perdido__";

function ZonaSoltarResultado({ stage, tipo }: { stage: PipelineStage; tipo: "ganado" | "perdido" }) {
  const esGanado = tipo === "ganado";
  const { setNodeRef, isOver } = useDroppable({ id: esGanado ? ZONA_GANADO_ID : ZONA_PERDIDO_ID });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 rounded-2xl border-2 border-dashed backdrop-blur-xl transition-all duration-200",
        "flex flex-col items-center justify-center gap-1 py-5",
        esGanado
          ? "border-emerald-400/40 dark:border-emerald-400/30 bg-emerald-50/70 dark:bg-emerald-500/[0.05] hover:bg-emerald-50 dark:hover:bg-emerald-500/[0.08]"
          : "border-red-400/40 dark:border-red-400/30 bg-red-50/70 dark:bg-red-500/[0.05] hover:bg-red-50 dark:hover:bg-red-500/[0.08]",
        isOver && (esGanado
          ? "border-emerald-400 dark:border-emerald-400/70 bg-emerald-100/80 dark:bg-emerald-500/[0.14] scale-[1.015]"
          : "border-red-400 dark:border-red-400/70 bg-red-100/80 dark:bg-red-500/[0.14] scale-[1.015]")
      )}
    >
      {esGanado
        ? <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        : <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
      <p className={cn("text-[13px] font-semibold", esGanado ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>
        {stage.nombre}
      </p>
      <p className="text-[11px] text-stone-500 dark:text-white/40">
        Suelta aquí las oportunidades {esGanado ? "ganadas" : "perdidas"}
      </p>
    </div>
  );
}

function ZonasResultadoRapido({
  stageGanado,
  stagePerdido,
}: {
  stageGanado?: PipelineStage;
  stagePerdido?: PipelineStage;
}) {
  if (!stageGanado && !stagePerdido) return null;
  return (
    <div className="absolute bottom-4 inset-x-3 z-30 flex gap-3">
      {stageGanado && <ZonaSoltarResultado stage={stageGanado} tipo="ganado" />}
      {stagePerdido && <ZonaSoltarResultado stage={stagePerdido} tipo="perdido" />}
    </div>
  );
}

// ── Kanban principal ──────────────────────────────────────────────

interface PipelineKanbanDinamicoProps {
  pipeline: PipelineConStages;
  oportunidadesPorStage: Map<string, OportunidadEnStage[]>;
  totalesPorStage?: Map<string, number>;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  defaultCountryCode?: string;
  puedeMod?: boolean;
  /** "Ver ocultos" activo — muestra también las columnas Ganado/Perdido con
   *  visible=false (ver panel-config-pipeline.tsx), que por defecto quedan
   *  fuera del tablero. */
  verOcultos?: boolean;
}

export function PipelineKanbanDinamico({
  pipeline,
  oportunidadesPorStage,
  totalesPorStage = new Map(),
  empresas,
  contactos,
  defaultCountryCode = "PA",
  puedeMod = true,
  verOcultos = false,
}: PipelineKanbanDinamicoProps) {
  const [localOps, setLocalOps] = useState(oportunidadesPorStage);
  const [localTotales, setLocalTotales] = useState(totalesPorStage);
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

  useEffect(() => {
    if (!activeCard) setLocalTotales(totalesPorStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalesPorStage]);

  // Las etapas Ganado/Perdido con visible=false no se muestran como columna,
  // pero la oportunidad se sigue pudiendo mover ahí (drag a otra vía o popover
  // "Mover a") — "Ver ocultos" las trae de vuelta al tablero sin tocar la
  // configuración del pipeline.
  const stagesColumnas = verOcultos
    ? pipeline.stages
    : pipeline.stages.filter((s) => !(s.esGanado || s.esPerdido) || s.visible);

  // Etapas destino de las zonas rápidas "Ganado"/"Perdido" que aparecen al
  // arrastrar — si el pipeline tiene más de una marcada, se usa la primera.
  const stageGanado = pipeline.stages.find((s) => s.esGanado);
  const stagePerdido = pipeline.stages.find((s) => s.esPerdido);

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
    // Las zonas rápidas usan ids centinela (no son etapas reales) — se
    // resuelven acá a la etapa Ganado/Perdido real del pipeline.
    let nuevoStageId = over.id as string;
    if (nuevoStageId === ZONA_GANADO_ID) nuevoStageId = stageGanado?.id ?? nuevoStageId;
    else if (nuevoStageId === ZONA_PERDIDO_ID) nuevoStageId = stagePerdido?.id ?? nuevoStageId;
    if (oportunidad.stageId === nuevoStageId) return;

    const nuevoStage = pipeline.stages.find((s) => s.id === nuevoStageId);
    if (!nuevoStage) return;

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

    setLocalTotales((prev) => {
      const next = new Map(prev);
      const anteriorKey = oportunidad.stageId ?? "__sin_stage__";
      next.set(anteriorKey, (next.get(anteriorKey) ?? 0) - oportunidad.valor);
      next.set(nuevoStageId, (next.get(nuevoStageId) ?? 0) + oportunidad.valor);
      return next;
    });

    moverMutation.mutate(
      { oportunidadId: oportunidad.id, nuevoStageId, pipelineId: pipeline.id },
      {
        onError: (err) => {
          toast.error(err.message ?? "Error al mover la oportunidad");
          setLocalOps(oportunidadesPorStage);
          setLocalTotales(totalesPorStage);
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
    let stageAnterior: string | null = null;
    let valorAnterior = 0;
    setLocalOps((prev) => {
      const next = new Map(prev);
      let tagsExistentes: OportunidadEnStage["tags"] = [];
      let contactoExistente: OportunidadEnStage["contacto"] = null;
      for (const [key, ops] of next) {
        const found = ops.find((o) => o.id === updated.id);
        if (found) {
          tagsExistentes = found.tags;
          contactoExistente = found.contacto;
          stageAnterior = key;
          valorAnterior = found.valor;
          break;
        }
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

    setLocalTotales((prev) => {
      const next = new Map(prev);
      const targetStage = updated.stageId ?? "__sin_stage__";
      if (stageAnterior) {
        next.set(stageAnterior, (next.get(stageAnterior) ?? 0) - valorAnterior);
      }
      next.set(targetStage, (next.get(targetStage) ?? 0) + updated.valor);
      return next;
    });
  };

  const handleDelete = (id: string) => {
    let stageEliminado: string | null = null;
    let valorEliminado = 0;
    setLocalOps((prev) => {
      const next = new Map(prev);
      for (const [key, ops] of next) {
        const found = ops.find((o) => o.id === id);
        if (found) { stageEliminado = key; valorEliminado = found.valor; }
        next.set(key, ops.filter((o) => o.id !== id));
      }
      return next;
    });
    if (stageEliminado) {
      setLocalTotales((prev) => {
        const next = new Map(prev);
        next.set(stageEliminado!, (next.get(stageEliminado!) ?? 0) - valorEliminado);
        return next;
      });
    }
    setSelected(null);
  };

  return (
    <div className="relative h-full">
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
              total={localTotales.get(stage.id) ?? 0}
              onCardClick={(op) => setSelected({ id: op.id, stageId: op.stageId ?? null })}
              puedeMod={puedeMod}
            />
          ))}
        </KanbanScrollContainer>

        <DragOverlay dropAnimation={{ duration: 150 }}>
          {activeCard && <TarjetaOverlay oportunidad={activeCard} />}
        </DragOverlay>

        {/* Zonas rápidas Ganado/Perdido — solo visibles mientras se arrastra
            una tarjeta, para soltarla directo sin buscar la columna
            correspondiente (útil si está lejos o escondida por "Ver
            ocultos"). */}
        {activeCard && puedeMod && (
          <ZonasResultadoRapido stageGanado={stageGanado} stagePerdido={stagePerdido} />
        )}
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
    </div>
  );
}
