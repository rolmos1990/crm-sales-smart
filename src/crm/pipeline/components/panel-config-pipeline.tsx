"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Loader2,
  Trophy,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  crearStage,
  actualizarStage,
  eliminarStage,
  reordenarStages,
  actualizarNombrePipeline,
  eliminarPipeline,
} from "../actions";
import { PanelConfigCampos } from "./panel-config-campos";
import { PanelConfigDisparadores } from "./panel-config-disparadores";
import type { PipelineConStages, PipelineStage } from "../types";

const COLORES_PALETTE = [
  "#818cf8", "#c084fc", "#f472b6", "#fb7185",
  "#f97316", "#fbbf24", "#a3e635", "#4ade80",
  "#34d399", "#22d3ee", "#60a5fa", "#94a3b8",
];

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger
        className="h-6 w-6 rounded-full border-2 border-white/30 shadow-sm hover:scale-110 transition-transform flex-shrink-0 cursor-pointer"
        style={{ backgroundColor: color }}
      />
      <PopoverContent className="w-auto p-2 bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10 rounded-xl shadow-xl">
        <div className="grid grid-cols-6 gap-1.5">
          {COLORES_PALETTE.map((c) => (
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

// ── Sortable Stage Item ───────────────────────────────────────────

function SortableStageItem({
  stage,
  onEditar,
  onEliminar,
}: {
  stage: PipelineStage;
  onEditar: (s: PipelineStage) => void;
  onEliminar: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
        "bg-white dark:bg-white/5 border-stone-200 dark:border-white/10",
        isDragging
          ? "opacity-50 shadow-xl border-lime-400/40 dark:border-lime-400/30 z-50"
          : "hover:border-stone-300 dark:hover:border-white/20"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 touch-none cursor-grab active:cursor-grabbing text-stone-300 dark:text-stone-600 hover:text-stone-500 dark:hover:text-stone-400 transition-colors"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div
        className="h-3 w-3 rounded-full flex-shrink-0 ring-1 ring-white/20"
        style={{ backgroundColor: stage.color ?? "#818cf8" }}
      />

      <span className="flex-1 text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
        {stage.nombre}
      </span>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {stage.esGanado && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 border border-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-500 dark:text-emerald-400">
            <Trophy className="h-2.5 w-2.5" /> Ganado
          </span>
        )}
        {stage.esPerdido && (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-500/12 border border-red-500/20 px-1.5 py-0.5 text-xs font-medium text-red-500 dark:text-red-400">
            <XCircle className="h-2.5 w-2.5" /> Perdido
          </span>
        )}
        <span className="text-xs text-stone-400 dark:text-stone-500 tabular-nums w-8 text-right">
          {stage.probabilidad}%
        </span>
        <button
          onClick={() => onEditar(stage)}
          className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onEliminar(stage.id)}
          className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/8 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Dialog de edición de stage ────────────────────────────────────

function DialogEditarStage({
  stage,
  open,
  onOpenChange,
  onGuardado,
}: {
  stage: PipelineStage | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGuardado: (s: PipelineStage) => void;
}) {
  const [nombre, setNombre] = useState(stage?.nombre ?? "");
  const [color, setColor] = useState(stage?.color ?? "#818cf8");
  const [probabilidad, setProbabilidad] = useState(stage?.probabilidad ?? 20);
  const [esGanado, setEsGanado] = useState(stage?.esGanado ?? false);
  const [esPerdido, setEsPerdido] = useState(stage?.esPerdido ?? false);
  const [isPending, startTransition] = useTransition();

  const handleGuardar = () => {
    if (!stage || !nombre.trim()) return;
    startTransition(async () => {
      const resultado = await actualizarStage(stage.id, { nombre: nombre.trim(), color, probabilidad, esGanado, esPerdido });
      if (resultado.exito) {
        toast.success("Etapa actualizada");
        onGuardado({ ...stage, nombre: nombre.trim(), color, probabilidad, esGanado, esPerdido });
        onOpenChange(false);
      } else {
        toast.error(resultado.error);
      }
    });
  };

  if (!stage) return null;

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
              <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1.5 block">
                Nombre
              </Label>
              <Input
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleGuardar(); }}
                className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1.5 block">
              Probabilidad de cierre: {probabilidad}%
            </Label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={probabilidad}
              onChange={(e) => setProbabilidad(Number(e.target.value))}
              className="w-full accent-lime-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setEsGanado(!esGanado); if (!esGanado) setEsPerdido(false); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium border transition-all",
                esGanado
                  ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/5"
              )}
            >
              <Trophy className="h-3.5 w-3.5" /> Etapa ganado
            </button>
            <button
              onClick={() => { setEsPerdido(!esPerdido); if (!esPerdido) setEsGanado(false); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium border transition-all",
                esPerdido
                  ? "bg-red-500/12 border-red-500/30 text-red-600 dark:text-red-400"
                  : "border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/5"
              )}
            >
              <XCircle className="h-3.5 w-3.5" /> Etapa perdido
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleGuardar}
            disabled={!nombre.trim() || isPending}
            className="rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Panel principal de configuración ─────────────────────────────

interface PanelConfigPipelineProps {
  pipeline: PipelineConStages;
  onPipelineActualizado: (p: PipelineConStages) => void;
  onPipelineEliminado: () => void;
}

export function PanelConfigPipeline({
  pipeline,
  onPipelineActualizado,
  onPipelineEliminado,
}: PanelConfigPipelineProps) {
  const [stages, setStages] = useState<PipelineStage[]>(pipeline.stages);
  const [nombrePipeline, setNombrePipeline] = useState(pipeline.nombre);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [stageEditando, setStageEditando] = useState<PipelineStage | null>(null);
  const [nuevaEtapaNombre, setNuevaEtapaNombre] = useState("");
  const [nuevaEtapaColor, setNuevaEtapaColor] = useState("#818cf8");
  const [mostrarFormNueva, setMostrarFormNueva] = useState(false);
  const [isPendingNombre, startTransitionNombre] = useTransition();
  const [isPendingNueva, startTransitionNueva] = useTransition();
  const [isPendingReorden, startTransitionReorden] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    const reordenadas = arrayMove(stages, oldIndex, newIndex);
    setStages(reordenadas);

    startTransitionReorden(async () => {
      const resultado = await reordenarStages(pipeline.id, reordenadas.map((s) => s.id));
      if (!resultado.exito) {
        toast.error(resultado.error);
        setStages(stages); // revert
      }
    });
  };

  const handleGuardarNombre = () => {
    if (!nombrePipeline.trim()) return;
    startTransitionNombre(async () => {
      const resultado = await actualizarNombrePipeline(pipeline.id, { nombre: nombrePipeline.trim() });
      if (resultado.exito) {
        toast.success("Nombre actualizado");
        setEditandoNombre(false);
        onPipelineActualizado({ ...pipeline, nombre: nombrePipeline.trim(), stages });
      } else {
        toast.error(resultado.error);
      }
    });
  };

  const handleEliminarStage = (id: string) => {
    const stagesActualizadas = stages.filter((s) => s.id !== id);
    setStages(stagesActualizadas);
    eliminarStage(id).then((r) => {
      if (r.exito) toast.success("Etapa eliminada");
      else { toast.error(r.error); setStages(stages); }
    });
  };

  const handleStageActualizado = (actualizado: PipelineStage) => {
    setStages((prev) => prev.map((s) => (s.id === actualizado.id ? actualizado : s)));
  };

  const handleCrearNuevaEtapa = () => {
    if (!nuevaEtapaNombre.trim()) return;
    startTransitionNueva(async () => {
      const resultado = await crearStage(pipeline.id, {
        nombre: nuevaEtapaNombre.trim(),
        color: nuevaEtapaColor,
        probabilidad: 20,
        esGanado: false,
        esPerdido: false,
      });
      if (resultado.exito) {
        const nuevaStage: PipelineStage = {
          id: resultado.id,
          nombre: nuevaEtapaNombre.trim(),
          color: nuevaEtapaColor,
          probabilidad: 20,
          esGanado: false,
          esPerdido: false,
          esInicial: false,
          descripcion: null,
          activo: true,
          pipelineId: pipeline.id,
          orden: stages.length,
        };
        setStages((prev) => [...prev, nuevaStage]);
        setNuevaEtapaNombre("");
        setNuevaEtapaColor("#818cf8");
        setMostrarFormNueva(false);
        toast.success("Etapa creada");
      } else {
        toast.error(resultado.error);
      }
    });
  };

  return (
    <Tabs defaultValue="etapas" className="flex flex-col gap-5">
      <TabsList variant="line" className="w-full justify-start border-b border-stone-200 dark:border-white/10 rounded-none pb-0 mb-1 h-auto gap-0">
        <TabsTrigger value="etapas" className="rounded-none px-4 py-2 text-sm font-medium border-b-2 border-transparent data-active:border-lime-500 dark:data-active:border-lime-400 data-active:text-stone-900 dark:data-active:text-stone-50">
          Etapas
        </TabsTrigger>
        <TabsTrigger value="campos" className="rounded-none px-4 py-2 text-sm font-medium border-b-2 border-transparent data-active:border-lime-500 dark:data-active:border-lime-400 data-active:text-stone-900 dark:data-active:text-stone-50">
          Campos personalizados
        </TabsTrigger>
        <TabsTrigger value="disparadores" className="rounded-none px-4 py-2 text-sm font-medium border-b-2 border-transparent data-active:border-lime-500 dark:data-active:border-lime-400 data-active:text-stone-900 dark:data-active:text-stone-50">
          Disparadores
        </TabsTrigger>
        <TabsTrigger value="peligro" className="rounded-none px-4 py-2 text-sm font-medium border-b-2 border-transparent data-active:border-red-500 data-active:text-red-600 dark:data-active:text-red-400">
          Zona peligrosa
        </TabsTrigger>
      </TabsList>

      {/* ── Tab: Etapas ─────────────────────────────────────────── */}
      <TabsContent value="etapas">
      <div className="flex flex-col gap-5 max-w-2xl">
      {/* Nombre del pipeline */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
          Nombre del pipeline
        </Label>
        {editandoNombre ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={nombrePipeline}
              onChange={(e) => setNombrePipeline(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGuardarNombre(); if (e.key === "Escape") setEditandoNombre(false); }}
              className="bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl max-w-xs"
            />
            <Button
              size="sm"
              onClick={handleGuardarNombre}
              disabled={isPendingNombre || !nombrePipeline.trim()}
              className="rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950 h-9 px-3"
            >
              {isPendingNombre ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setNombrePipeline(pipeline.nombre); setEditandoNombre(false); }}
              className="rounded-xl h-9 px-3"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-stone-900 dark:text-stone-50">
              {pipeline.nombre}
            </span>
            <button
              onClick={() => setEditandoNombre(true)}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Lista sortable de etapas */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
            Etapas · arrastra para reordenar
          </Label>
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {stages.length} etapas
          </span>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {stages.map((stage) => (
                <SortableStageItem
                  key={stage.id}
                  stage={stage}
                  onEditar={setStageEditando}
                  onEliminar={handleEliminarStage}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Añadir nueva etapa */}
        {mostrarFormNueva ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-stone-300 dark:border-white/15 bg-stone-50/50 dark:bg-white/3">
            <ColorPicker color={nuevaEtapaColor} onChange={setNuevaEtapaColor} />
            <Input
              autoFocus
              placeholder="Nombre de la etapa"
              value={nuevaEtapaNombre}
              onChange={(e) => setNuevaEtapaNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCrearNuevaEtapa(); if (e.key === "Escape") setMostrarFormNueva(false); }}
              className="flex-1 bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-8 text-sm"
            />
            <Button
              size="sm"
              onClick={handleCrearNuevaEtapa}
              disabled={isPendingNueva || !nuevaEtapaNombre.trim()}
              className="h-8 px-3 rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950"
            >
              {isPendingNueva ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <button
              onClick={() => setMostrarFormNueva(false)}
              className="h-8 w-8 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMostrarFormNueva(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-stone-300 dark:border-white/12 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:border-stone-400 dark:hover:border-white/20 hover:bg-stone-50 dark:hover:bg-white/3 transition-all text-sm"
          >
            <Plus className="h-4 w-4" />
            Añadir etapa
          </button>
        )}
      </div>

      <DialogEditarStage
        key={stageEditando?.id ?? "none"}
        stage={stageEditando}
        open={!!stageEditando}
        onOpenChange={(v) => { if (!v) setStageEditando(null); }}
        onGuardado={handleStageActualizado}
      />
      </div>
      </TabsContent>

      {/* ── Tab: Campos personalizados ───────────────────────────── */}
      <TabsContent value="campos">
        <PanelConfigCampos pipeline={{ ...pipeline, stages }} />
      </TabsContent>

      {/* ── Tab: Disparadores ───────────────────────────────────── */}
      <TabsContent value="disparadores">
        <PanelConfigDisparadores pipeline={{ ...pipeline, stages }} />
      </TabsContent>

      {/* ── Tab: Zona peligrosa ──────────────────────────────────── */}
      <TabsContent value="peligro">
        <div className="max-w-2xl space-y-3 pt-2">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Las acciones en esta sección son irreversibles. Procede con cuidado.
          </p>
          <div className="rounded-xl border border-red-500/20 dark:border-red-400/15 bg-red-500/4 px-4 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                Eliminar pipeline
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Se eliminarán todas las etapas y los campos personalizados asociados.
                Las oportunidades no se eliminan.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm(`¿Eliminar el pipeline "${pipeline.nombre}"? Esta acción no se puede deshacer.`)) {
                  eliminarPipeline(pipeline.id).then((r) => {
                    if (r.exito) { toast.success("Pipeline eliminado"); onPipelineEliminado(); }
                    else toast.error(r.error);
                  });
                }
              }}
              className="flex-shrink-0 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-500/8 hover:text-red-600 dark:hover:text-red-300 border border-red-500/25 hover:border-red-500/40 text-xs"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Eliminar pipeline
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
