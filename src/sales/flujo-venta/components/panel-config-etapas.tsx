"use client";

import { useState, useTransition } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Pencil, Trash2, Plus, Check, X, Loader2, Flag, XCircle, Circle,
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
import { cn } from "@/lib/utils";
import { crearEtapa, actualizarEtapa, eliminarEtapa, reordenarEtapas } from "../actions";
import type { FlujoVentaEtapa } from "../types";
import { COLORES_ETAPA } from "../types";

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
  etapa, onEditar, onEliminar,
}: {
  etapa: FlujoVentaEtapa;
  onEditar: (e: FlujoVentaEtapa) => void;
  onEliminar: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: etapa.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
        "bg-white dark:bg-white/5 border-stone-200 dark:border-white/10",
        isDragging ? "opacity-50 shadow-xl border-lime-400/40 z-50" : "hover:border-stone-300 dark:hover:border-white/20"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 touch-none cursor-grab active:cursor-grabbing text-stone-300 dark:text-stone-600 hover:text-stone-500 dark:hover:text-stone-400"
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
        <button onClick={() => onEditar(etapa)} className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onEliminar(etapa.id)} className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-500/8 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
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
  const [isPending, startTransition] = useTransition();

  const handleGuardar = () => {
    if (!etapa || !nombre.trim()) return;
    startTransition(async () => {
      const resultado = await actualizarEtapa(etapa.id, {
        nombre: nombre.trim(), color, orden: etapa.orden,
        esInicial, esFinal, esCancelacion, activo: true,
      });
      if (resultado.exito) {
        toast.success("Etapa actualizada");
        onGuardado({ ...etapa, nombre: nombre.trim(), color, esInicial, esFinal, esCancelacion });
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
              onClick={() => { setEsInicial(!esInicial); }}
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
  const [etapas, setEtapas] = useState<FlujoVentaEtapa[]>(etapasIniciales);
  const [etapaEditando, setEtapaEditando] = useState<FlujoVentaEtapa | null>(null);
  const [nuevaNombre, setNuevaNombre] = useState("");
  const [nuevaColor, setNuevaColor] = useState("#4ade80");
  const [mostrarFormNueva, setMostrarFormNueva] = useState(false);
  const [isPendingNueva, startTransitionNueva] = useTransition();
  const [, startTransitionReorden] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = etapas.findIndex((e) => e.id === active.id);
    const newIndex = etapas.findIndex((e) => e.id === over.id);
    const reordenadas = arrayMove(etapas, oldIndex, newIndex);
    setEtapas(reordenadas);
    startTransitionReorden(async () => {
      const r = await reordenarEtapas(reordenadas.map((e) => e.id));
      if (!r.exito) { toast.error(r.error); setEtapas(etapas); }
    });
  };

  const handleCrear = () => {
    if (!nuevaNombre.trim()) return;
    startTransitionNueva(async () => {
      const r = await crearEtapa(flujoVentaId, {
        nombre: nuevaNombre.trim(), color: nuevaColor, orden: etapas.length,
        esInicial: false, esFinal: false, esCancelacion: false, activo: true,
      });
      if (r.exito) {
        const nueva: FlujoVentaEtapa = {
          id: r.datos.id, nombre: nuevaNombre.trim(), color: nuevaColor, orden: etapas.length,
          esInicial: false, esFinal: false, esCancelacion: false, activo: true, descripcion: null, flujoVentaId,
        };
        setEtapas((prev) => [...prev, nueva]);
        setNuevaNombre(""); setNuevaColor("#4ade80"); setMostrarFormNueva(false);
        toast.success("Etapa creada");
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleEliminar = (id: string) => {
    const prev = etapas;
    setEtapas((e) => e.filter((x) => x.id !== id));
    eliminarEtapa(id).then((r) => {
      if (r.exito) toast.success("Etapa eliminada");
      else { toast.error(r.error); setEtapas(prev); }
    });
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
            Etapas · arrastra para reordenar
          </Label>
          <span className="text-xs text-stone-400">{etapas.length} etapas</span>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={etapas.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {etapas.map((etapa) => (
                <SortableEtapaItem key={etapa.id} etapa={etapa} onEditar={setEtapaEditando} onEliminar={handleEliminar} />
              ))}
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
        onGuardado={(actualizada) => setEtapas((prev) => prev.map((e) => e.id === actualizada.id ? actualizada : e))}
      />
    </div>
  );
}
