"use client";

import { useState, useTransition } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Pencil, Trash2, Plus, Check, X, Loader2, Flag, XCircle, Circle, Shuffle, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { crearEtapa, actualizarEtapa, eliminarEtapa, reordenarEtapas } from "../actions";
import type { FlujoVentaEtapa } from "../types";
import { COLORES_ETAPA } from "../types";

const INDENT_WIDTH = 32;
const MAX_DEPTH = 2;

type EtapaFlat = FlujoVentaEtapa & { depth: number; esSecuencial: boolean };

// Convierte lista plana con parentId a lista plana con depth, en orden correcto (DFS)
function flattenTree(etapas: FlujoVentaEtapa[]): EtapaFlat[] {
  const result: EtapaFlat[] = [];

  function walk(parentId: string | null, depth: number) {
    etapas
      .filter((e) => e.parentId === parentId)
      .sort((a, b) => a.orden - b.orden)
      .forEach((e) => {
        result.push({ ...e, depth });
        walk(e.id, depth + 1);
      });
  }

  walk(null, 0);
  return result;
}

// Calcula el parentId proyectado durante el drag basado en la posición horizontal
function getProjection(
  items: EtapaFlat[],
  activeId: string,
  overId: string,
  deltaX: number,
): { parentId: string | null; depth: number } {
  const overIndex = items.findIndex((i) => i.id === overId);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const activeItem = items[activeIndex];

  const depthDelta = Math.round(deltaX / INDENT_WIDTH);
  const projectedDepth = Math.max(0, Math.min(MAX_DEPTH, activeItem.depth + depthDelta));

  // El item justo arriba de la posición destino determina el padre posible
  const prevItem = items.slice(0, overIndex).reverse().find((i) => i.depth <= projectedDepth);

  let parentId: string | null = null;
  if (projectedDepth === 0) {
    parentId = null;
  } else if (prevItem) {
    if (prevItem.depth === projectedDepth) {
      parentId = prevItem.parentId;
    } else {
      parentId = prevItem.id;
    }
  }

  return { parentId, depth: projectedDepth };
}

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger
        className="h-6 w-6 rounded-full border-2 border-white/30 shadow-sm hover:scale-110 transition-transform flex-shrink-0 cursor-pointer"
        style={{ backgroundColor: color || "#4ade80" }}
      />
      <PopoverContent className="w-auto p-2 bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10 rounded-xl shadow-xl">
        <div className="grid grid-cols-4 gap-1.5">
          {COLORES_ETAPA.map((c) => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={cn(
                "h-6 w-6 rounded-full transition-all hover:scale-110 border-2",
                color === c ? "border-white shadow-lg scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortableEtapaItem({
  etapa, depth, isProjected, onEditar, onEliminar,
}: {
  etapa: EtapaFlat;
  depth: number;
  isProjected: boolean;
  onEditar: (e: FlujoVentaEtapa) => void;
  onEliminar: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: etapa.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        paddingLeft: depth * INDENT_WIDTH,
      }}
      className={cn(isDragging && "opacity-50 z-50")}
    >
      {/* Guía visual de indentación */}
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
          "bg-white dark:bg-white/5 border-stone-200 dark:border-white/10",
          isDragging
            ? "shadow-xl border-lime-400/40"
            : "hover:border-stone-300 dark:hover:border-white/20",
          isProjected && "border-lime-400/60 dark:border-lime-400/40 bg-lime-50/30 dark:bg-lime-400/5",
          depth > 0 && "border-l-2"
        )}
        style={depth > 0 ? { borderLeftColor: etapa.color ?? "#4ade80" } : undefined}
      >
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 touch-none cursor-grab active:cursor-grabbing text-stone-300 dark:text-stone-600 hover:text-stone-500 dark:hover:text-stone-400"
          title="Arrastra arriba/abajo para reordenar, izquierda/derecha para anidar"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="h-3 w-3 rounded-full flex-shrink-0 ring-1 ring-white/20" style={{ backgroundColor: etapa.color ?? "#4ade80" }} />

        <span className="flex-1 text-sm font-medium text-stone-800 dark:text-stone-200 truncate">{etapa.nombre}</span>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {etapa.esInicial && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/12 border border-blue-500/20 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
              <Circle className="h-2.5 w-2.5 fill-current" /> Inicial
            </span>
          )}
          {etapa.esFinal && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 border border-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Flag className="h-2.5 w-2.5" /> Final
            </span>
          )}
          {etapa.esCancelacion && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-500/12 border border-red-500/20 px-1.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
              <XCircle className="h-2.5 w-2.5" /> Cancelación
            </span>
          )}
          {!etapa.esSecuencial && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/12 border border-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Shuffle className="h-2.5 w-2.5" /> Manual
            </span>
          )}
          {depth > 0 && (
            <span className="inline-flex items-center rounded-md bg-stone-100 dark:bg-white/8 border border-stone-200 dark:border-white/10 px-1.5 py-0.5 text-xs text-stone-400 dark:text-stone-500">
              sub-etapa
            </span>
          )}
          <button
            onClick={() => onEditar(etapa)}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEliminar(etapa.id)}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-500/8 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DialogEditarEtapa({
  etapa, open, onOpenChange, onGuardado,
}: {
  etapa: FlujoVentaEtapa | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGuardado: (e: FlujoVentaEtapa) => void;
}) {
  const [nombre, setNombre] = useState(etapa?.nombre ?? "");
  const [color, setColor] = useState(etapa?.color ?? "#4ade80");
  const [esInicial, setEsInicial] = useState(etapa?.esInicial ?? false);
  const [esFinal, setEsFinal] = useState(etapa?.esFinal ?? false);
  const [esCancelacion, setEsCancelacion] = useState(etapa?.esCancelacion ?? false);
  const [esSecuencial, setEsSecuencial] = useState(etapa?.esSecuencial ?? true);
  const [permiteEditar, setPermiteEditar] = useState(etapa?.permiteEditarPedido ?? true);
  const [isPending, startTransition] = useTransition();

  const tipoFlujoLocked = esInicial || esFinal || esCancelacion;
  const permiteLocked = esInicial || esFinal || esCancelacion;
  const permiteEfectivo = (esFinal || esCancelacion) ? false : esInicial ? true : permiteEditar;

  const handleGuardar = () => {
    if (!etapa || !nombre.trim()) return;
    startTransition(async () => {
      const secuencialFinal = tipoFlujoLocked ? true : esSecuencial;
      const resultado = await actualizarEtapa(etapa.id, {
        nombre: nombre.trim(), color, orden: etapa.orden,
        esInicial, esFinal, esCancelacion, esSecuencial: secuencialFinal,
        permiteEditarPedido: permiteEfectivo, activo: true, parentId: etapa.parentId,
      });
      if (resultado.exito) {
        toast.success("Etapa actualizada");
        onGuardado({ ...etapa, nombre: nombre.trim(), color, esInicial, esFinal, esCancelacion, esSecuencial: secuencialFinal, permiteEditarPedido: permiteEfectivo });
        onOpenChange(false);
      } else {
        toast.error(resultado.error);
      }
    });
  };

  if (!etapa) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="text-stone-900 dark:text-stone-50">Editar etapa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <ColorPicker color={color} onChange={setColor} />
            <div className="flex-1">
              <Label className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5 block">Nombre</Label>
              <Input
                autoFocus value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleGuardar(); }}
                className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEsInicial(!esInicial)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium border transition-all",
                esInicial ? "bg-blue-500/12 border-blue-500/30 text-blue-600 dark:text-blue-400" : "border-stone-200 dark:border-white/10 text-stone-500 hover:bg-stone-50 dark:hover:bg-white/5"
              )}
            >
              <Circle className="h-3.5 w-3.5" /> Inicial
            </button>
            <button
              onClick={() => { setEsFinal(!esFinal); if (!esFinal) setEsCancelacion(false); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium border transition-all",
                esFinal ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "border-stone-200 dark:border-white/10 text-stone-500 hover:bg-stone-50 dark:hover:bg-white/5"
              )}
            >
              <Flag className="h-3.5 w-3.5" /> Final
            </button>
            <button
              onClick={() => { setEsCancelacion(!esCancelacion); if (!esCancelacion) setEsFinal(false); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium border transition-all",
                esCancelacion ? "bg-red-500/12 border-red-500/30 text-red-600 dark:text-red-400" : "border-stone-200 dark:border-white/10 text-stone-500 hover:bg-stone-50 dark:hover:bg-white/5"
              )}
            >
              <XCircle className="h-3.5 w-3.5" /> Cancelación
            </button>
          </div>

          {/* Tipo de flujo */}
          <div className={cn(
            "rounded-xl border p-3 transition-all",
            tipoFlujoLocked
              ? "opacity-50 cursor-not-allowed border-stone-200 dark:border-white/10"
              : "border-stone-200 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20"
          )}>
            <button
              type="button"
              disabled={tipoFlujoLocked}
              onClick={() => !tipoFlujoLocked && setEsSecuencial(!esSecuencial)}
              className="w-full flex items-center justify-between gap-3 disabled:cursor-not-allowed"
            >
              <div className="text-left">
                <p className={cn(
                  "text-xs font-medium",
                  (tipoFlujoLocked ? true : esSecuencial)
                    ? "text-stone-800 dark:text-stone-200"
                    : "text-amber-600 dark:text-amber-400"
                )}>
                  {(tipoFlujoLocked ? true : esSecuencial) ? "Secuencial" : "Manual"}
                </p>
                <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                  {(tipoFlujoLocked ? true : esSecuencial)
                    ? "Respeta el orden del flujo y se sugiere como siguiente paso."
                    : "Disponible para selección manual, no depende del orden automático."}
                </p>
              </div>
              <div className={cn(
                "relative flex-shrink-0 h-5 w-9 rounded-full transition-colors",
                (tipoFlujoLocked ? true : esSecuencial) ? "bg-lime-500" : "bg-stone-300 dark:bg-white/20"
              )}>
                <span className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                  (tipoFlujoLocked ? true : esSecuencial) ? "translate-x-4" : "translate-x-0"
                )} />
              </div>
            </button>
          </div>
          {/* Permitir edición de pedidos */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="w-full text-left">
                <div className={cn(
                  "rounded-xl border p-3 transition-all",
                  permiteLocked
                    ? "opacity-50 cursor-not-allowed border-stone-200 dark:border-white/10"
                    : "border-stone-200 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20"
                )}>
                  <button
                    type="button"
                    disabled={permiteLocked}
                    onClick={() => !permiteLocked && setPermiteEditar(!permiteEditar)}
                    className="w-full flex items-center justify-between gap-3 disabled:cursor-not-allowed"
                  >
                    <div className="text-left flex items-start gap-2">
                      <Lock className="h-3.5 w-3.5 mt-0.5 text-stone-400 flex-shrink-0" />
                      <div>
                        <p className={cn(
                          "text-xs font-medium",
                          permiteEfectivo ? "text-stone-800 dark:text-stone-200" : "text-red-600 dark:text-red-400"
                        )}>
                          {permiteEfectivo ? "Edición permitida" : "Edición bloqueada"}
                        </p>
                        <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                          Permite modificar pedidos en esta etapa.
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "relative flex-shrink-0 h-5 w-9 rounded-full transition-colors",
                      permiteEfectivo ? "bg-lime-500" : "bg-stone-300 dark:bg-white/20"
                    )}>
                      <span className={cn(
                        "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        permiteEfectivo ? "translate-x-4" : "translate-x-0"
                      )} />
                    </div>
                  </button>
                </div>
              </TooltipTrigger>
              {permiteLocked && (
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {(esFinal || esCancelacion)
                    ? "Los pedidos en etapas finales o canceladas no pueden ser editados."
                    : "Las etapas iniciales siempre permiten editar pedidos."}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleGuardar} disabled={!nombre.trim() || isPending} className="rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PanelConfigEtapasProps {
  flujoVentaId: string;
  etapasIniciales: FlujoVentaEtapa[];
}

export function PanelConfigEtapas({ flujoVentaId, etapasIniciales }: PanelConfigEtapasProps) {
  const [items, setItems] = useState<EtapaFlat[]>(() => flattenTree(etapasIniciales));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [etapaEditando, setEtapaEditando] = useState<FlujoVentaEtapa | null>(null);
  const [nuevaNombre, setNuevaNombre] = useState("");
  const [nuevaColor, setNuevaColor] = useState("#4ade80");
  const [mostrarFormNueva, setMostrarFormNueva] = useState(false);
  const [isPendingNueva, startTransitionNueva] = useTransition();
  const [, startTransitionReorden] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const projected =
    activeId && overId
      ? getProjection(items, activeId, overId, offsetX)
      : null;

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
    setOverId(active.id as string);
  };

  const handleDragMove = ({ delta, over }: DragMoveEvent) => {
    setOffsetX(delta.x);
    if (over) setOverId(over.id as string);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const activeIndex = items.findIndex((i) => i.id === active.id);
    const activeItem = items[activeIndex];
    const { parentId, depth } = projected ?? { parentId: activeItem.parentId, depth: activeItem.depth };

    // Drag solo horizontal (over null o sobre sí mismo): aplicar solo el nuevo parentId
    if (!over || active.id === over.id) {
      if (parentId === activeItem.parentId) { resetDrag(); return; }
      const actualizado = items.map((item) =>
        item.id === active.id ? { ...item, parentId, depth } : item
      );
      const conOrden = recalcularOrden(actualizado);
      setItems(conOrden);
      const prev = items;
      startTransitionReorden(async () => {
        const r = await reordenarEtapas(conOrden.map((i) => ({ id: i.id, parentId: i.parentId, orden: i.orden })));
        if (!r.exito) { toast.error(r.error ?? "Error al reordenar"); setItems(prev); }
      });
      resetDrag();
      return;
    }

    // Drag vertical (reordenar) + posible cambio de parentId
    const overIndex = items.findIndex((i) => i.id === over.id);
    let reordenados = arrayMove(items, activeIndex, overIndex);
    reordenados = reordenados.map((item) =>
      item.id === active.id ? { ...item, parentId, depth } : item
    );
    const conOrden = recalcularOrden(reordenados);
    setItems(conOrden);

    const prev = items;
    startTransitionReorden(async () => {
      const r = await reordenarEtapas(conOrden.map((i) => ({ id: i.id, parentId: i.parentId, orden: i.orden })));
      if (!r.exito) { toast.error(r.error ?? "Error al reordenar"); setItems(prev); }
    });

    resetDrag();
  };

  const handleDragCancel = () => resetDrag();

  const resetDrag = () => {
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
  };

  // Asigna orden secuencial dentro de cada grupo de siblings
  function recalcularOrden(flat: EtapaFlat[]): EtapaFlat[] {
    const contadores = new Map<string | null, number>();
    return flat.map((item) => {
      const key = item.parentId ?? null;
      const orden = contadores.get(key) ?? 0;
      contadores.set(key, orden + 1);
      return { ...item, orden };
    });
  }

  const handleCrear = () => {
    if (!nuevaNombre.trim()) return;
    startTransitionNueva(async () => {
      const r = await crearEtapa(flujoVentaId, {
        nombre: nuevaNombre.trim(), color: nuevaColor, orden: items.length,
        esInicial: false, esFinal: false, esCancelacion: false, esSecuencial: true, activo: true, parentId: null,
      });
      if (r.exito) {
        const nueva: EtapaFlat = {
          id: r.datos.id, nombre: nuevaNombre.trim(), color: nuevaColor, orden: items.length,
          esInicial: false, esFinal: false, esCancelacion: false, esSecuencial: true, permiteEditarPedido: true, activo: true,
          descripcion: null, flujoVentaId, parentId: null, depth: 0,
        };
        setItems((prev) => [...prev, nueva]);
        setNuevaNombre(""); setNuevaColor("#4ade80"); setMostrarFormNueva(false);
        toast.success("Etapa creada");
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleEliminar = (id: string) => {
    const prev = items;
    // Eliminar la etapa y sus hijos
    const idsAEliminar = new Set<string>();
    const collectChildren = (parentId: string) => {
      idsAEliminar.add(parentId);
      items.filter((i) => i.parentId === parentId).forEach((i) => collectChildren(i.id));
    };
    collectChildren(id);
    setItems((e) => e.filter((x) => !idsAEliminar.has(x.id)));
    eliminarEtapa(id).then((r) => {
      if (r.exito) toast.success("Etapa eliminada");
      else { toast.error(r.error); setItems(prev); }
    });
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
              Etapas · arrastra para reordenar o anidar
            </Label>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
              Arrastra a la <strong>derecha</strong> para crear sub-etapas (máx. {MAX_DEPTH} niveles)
            </p>
          </div>
          <span className="text-xs text-stone-400">{items.length} etapas</span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={items.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {items.map((etapa) => {
                const depth = activeId === etapa.id && projected ? projected.depth : etapa.depth;
                return (
                  <SortableEtapaItem
                    key={etapa.id}
                    etapa={etapa}
                    depth={depth}
                    isProjected={activeId === etapa.id && !!projected}
                    onEditar={setEtapaEditando}
                    onEliminar={handleEliminar}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {mostrarFormNueva ? (
          <div className="flex items-center gap-2 px-3 py-2.5 mt-1.5 rounded-xl border border-dashed border-stone-300 dark:border-white/15 bg-stone-50/50 dark:bg-white/3">
            <ColorPicker color={nuevaColor} onChange={setNuevaColor} />
            <Input
              autoFocus placeholder="Nombre de la etapa"
              value={nuevaNombre}
              onChange={(e) => setNuevaNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCrear(); if (e.key === "Escape") setMostrarFormNueva(false); }}
              className="flex-1 bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-8 text-sm"
            />
            <Button size="sm" onClick={handleCrear} disabled={isPendingNueva || !nuevaNombre.trim()} className="h-8 px-3 rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950">
              {isPendingNueva ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <button onClick={() => setMostrarFormNueva(false)} className="h-8 w-8 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMostrarFormNueva(true)}
            className="mt-1.5 flex items-center gap-2 px-3 py-2.5 w-full rounded-xl border border-dashed border-stone-300 dark:border-white/12 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:border-stone-400 dark:hover:border-white/20 hover:bg-stone-50 dark:hover:bg-white/3 transition-all text-sm"
          >
            <Plus className="h-4 w-4" /> Añadir etapa
          </button>
        )}
      </div>

      <DialogEditarEtapa
        key={etapaEditando?.id ?? "none"}
        etapa={etapaEditando}
        open={!!etapaEditando}
        onOpenChange={(v) => { if (!v) setEtapaEditando(null); }}
        onGuardado={(actualizada) =>
          setItems((prev) => prev.map((e) => e.id === actualizada.id ? { ...e, ...actualizada } : e))
        }
      />
    </div>
  );
}
