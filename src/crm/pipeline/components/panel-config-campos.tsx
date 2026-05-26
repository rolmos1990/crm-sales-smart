"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ToggleLeft,
  Lock,
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  crearCampoStage,
  actualizarCampoStage,
  eliminarCampoStage,
  duplicarCampoStage,
} from "../actions";
import type { PipelineConStages, CampoPersonalizadoStage, TipoCampo } from "../types";

// ── Catálogo de tipos ─────────────────────────────────────────────

const TIPOS: { valor: TipoCampo; etiqueta: string }[] = [
  { valor: "TEXTO",       etiqueta: "Texto corto" },
  { valor: "TEXTO_LARGO", etiqueta: "Texto largo" },
  { valor: "NUMERO",      etiqueta: "Número entero" },
  { valor: "DECIMAL",     etiqueta: "Número decimal" },
  { valor: "FECHA",       etiqueta: "Fecha" },
  { valor: "BOOLEANO",    etiqueta: "Sí / No" },
  { valor: "SELECT",      etiqueta: "Selección única" },
  { valor: "MULTISELECT", etiqueta: "Selección múltiple" },
  { valor: "EMAIL",       etiqueta: "Email" },
  { valor: "TELEFONO",    etiqueta: "Teléfono" },
  { valor: "URL",         etiqueta: "URL" },
];

const TIPO_LABEL: Record<TipoCampo, string> = Object.fromEntries(
  TIPOS.map((t) => [t.valor, t.etiqueta])
) as Record<TipoCampo, string>;

function slugificar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function BadgeTipo({ tipo }: { tipo: TipoCampo }) {
  return (
    <span className="inline-flex items-center rounded-md bg-stone-100 dark:bg-white/8 border border-stone-200 dark:border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 dark:text-stone-400 flex-shrink-0">
      {TIPO_LABEL[tipo]}
    </span>
  );
}

// ── Editor de opciones ────────────────────────────────────────────

function EditorOpciones({ opciones, onChange }: { opciones: string[]; onChange: (v: string[]) => void }) {
  const [nueva, setNueva] = useState("");

  const agregar = () => {
    const v = nueva.trim();
    if (!v || opciones.includes(v)) return;
    onChange([...opciones, v]);
    setNueva("");
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide block">
        Opciones
      </Label>
      <div className="space-y-1.5">
        {opciones.map((op, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="flex-1 text-sm bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-lg px-2.5 py-1 text-stone-700 dark:text-stone-300">
              {op}
            </span>
            <button
              onClick={() => onChange(opciones.filter((_, j) => j !== i))}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/8 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          placeholder="Nueva opción…"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
          className="flex-1 h-8 text-sm bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
        />
        <Button size="sm" variant="ghost" onClick={agregar} className="h-8 px-2.5 rounded-xl border border-stone-200 dark:border-white/10">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Toggle visual reutilizable ────────────────────────────────────

function ToggleOpcion({
  activo,
  onChange,
  icono,
  etiqueta,
  colorActivo = "lime",
}: {
  activo: boolean;
  onChange: () => void;
  icono: React.ReactNode;
  etiqueta: string;
  colorActivo?: "lime" | "amber";
}) {
  const colors = colorActivo === "amber"
    ? { bg: "bg-amber-500/8 border-amber-500/25 dark:border-amber-400/25", text: "text-amber-700 dark:text-amber-300", icon: "text-amber-600 dark:text-amber-400", track: "bg-amber-500 dark:bg-amber-400" }
    : { bg: "bg-lime-500/8 border-lime-500/25 dark:border-lime-400/25", text: "text-lime-700 dark:text-lime-300", icon: "text-lime-600 dark:text-lime-400", track: "bg-lime-500 dark:bg-lime-400" };

  return (
    <button
      onClick={onChange}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all",
        activo ? colors.bg : "border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/5"
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-4 w-4", activo ? colors.icon : "text-stone-400")}>{icono}</span>
        <span className={cn("text-sm font-medium", activo ? colors.text : "text-stone-600 dark:text-stone-400")}>
          {etiqueta}
        </span>
      </div>
      <div className={cn("h-5 w-9 rounded-full transition-colors relative", activo ? colors.track : "bg-stone-200 dark:bg-stone-700")}>
        <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", activo ? "translate-x-4" : "translate-x-0.5")} />
      </div>
    </button>
  );
}

// ── Dialog crear / editar campo ───────────────────────────────────

interface DatosFormCampo {
  nombre: string;
  clave: string;
  tipo: TipoCampo;
  requerido: boolean;
  bloqueado: boolean;
  descripcion: string;
  opciones: string[];
}

function DialogCampo({
  open,
  onOpenChange,
  campoInicial,
  pipelineId,
  stageId,
  onGuardado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campoInicial: CampoPersonalizadoStage | null;
  pipelineId: string;
  stageId: string;
  onGuardado: (campo: CampoPersonalizadoStage) => void;
}) {
  const esNuevo = !campoInicial;
  const [form, setForm] = useState<DatosFormCampo>({
    nombre:      campoInicial?.nombre      ?? "",
    clave:       campoInicial?.clave       ?? "",
    tipo:        campoInicial?.tipo        ?? "TEXTO",
    requerido:   campoInicial?.requerido   ?? false,
    bloqueado:   campoInicial?.bloqueado   ?? false,
    descripcion: campoInicial?.descripcion ?? "",
    opciones:    campoInicial?.opciones    ?? [],
  });
  const [claveManual, setClaveManual] = useState(!esNuevo);
  const [isPending, startTransition] = useTransition();

  const setField = <K extends keyof DatosFormCampo>(k: K, v: DatosFormCampo[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleNombreChange = (v: string) => {
    setField("nombre", v);
    if (!claveManual) setField("clave", slugificar(v));
  };

  const conOpciones = form.tipo === "SELECT" || form.tipo === "MULTISELECT";

  const handleGuardar = () => {
    if (!form.nombre.trim() || !form.clave.trim()) return;
    const datos = {
      nombre:      form.nombre.trim(),
      clave:       form.clave,
      tipo:        form.tipo,
      requerido:   form.requerido,
      bloqueado:   form.bloqueado,
      descripcion: form.descripcion.trim() || null,
      opciones:    conOpciones && form.opciones.length > 0 ? form.opciones : null,
    };
    startTransition(async () => {
      if (esNuevo) {
        const r = await crearCampoStage(pipelineId, stageId, datos);
        if (r.exito) {
          toast.success("Campo creado");
          onGuardado({
            id: r.id,
            nombre:      datos.nombre,
            clave:       datos.clave,
            tipo:        datos.tipo,
            requerido:   datos.requerido,
            bloqueado:   datos.bloqueado,
            descripcion: datos.descripcion,
            opciones:    datos.opciones,
            orden:       0,
            activo:      true,
            stageId,
            pipelineId,
          });
          onOpenChange(false);
        } else {
          toast.error(r.error);
        }
      } else {
        const r = await actualizarCampoStage(campoInicial!.id, datos);
        if (r.exito) {
          toast.success("Campo actualizado");
          onGuardado({ ...campoInicial!, ...datos });
          onOpenChange(false);
        } else {
          toast.error(r.error);
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="text-stone-900 dark:text-stone-50">
            {esNuevo ? "Nuevo campo" : "Editar campo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide block">
              Nombre del campo
            </Label>
            <Input
              autoFocus
              value={form.nombre}
              onChange={(e) => handleNombreChange(e.target.value)}
              placeholder="ej. Presupuesto aprobado"
              className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide block">
              Clave (identificador único)
            </Label>
            <Input
              value={form.clave}
              onChange={(e) => {
                setClaveManual(true);
                setField("clave", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
              }}
              placeholder="presupuesto_aprobado"
              className="font-mono text-sm bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
            />
            <p className="text-[10px] text-stone-400 dark:text-stone-500">
              Solo minúsculas, números y guión bajo.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide block">
              Tipo de dato
            </Label>
            <Select value={form.tipo} onValueChange={(v) => setField("tipo", v as TipoCampo)}>
              <SelectTrigger className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>{t.etiqueta}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {conOpciones && (
            <EditorOpciones opciones={form.opciones} onChange={(v) => setField("opciones", v)} />
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide block">
              Descripción (opcional)
            </Label>
            <Input
              value={form.descripcion}
              onChange={(e) => setField("descripcion", e.target.value)}
              placeholder="Ayuda al equipo a saber qué ingresar"
              className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <ToggleOpcion
              activo={form.requerido}
              onChange={() => setField("requerido", !form.requerido)}
              icono={<ToggleLeft className="h-4 w-4" />}
              etiqueta="Campo requerido"
            />
            <ToggleOpcion
              activo={form.bloqueado}
              onChange={() => setField("bloqueado", !form.bloqueado)}
              icono={<Lock className="h-4 w-4" />}
              etiqueta="Campo bloqueado (solo lectura)"
              colorActivo="amber"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleGuardar}
            disabled={!form.nombre.trim() || !form.clave.trim() || isPending}
            className="rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {esNuevo ? "Crear campo" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── CampoItem draggable ───────────────────────────────────────────

function CampoItem({
  campo,
  onEditar,
  onEliminar,
}: {
  campo: CampoPersonalizadoStage;
  onEditar: (c: CampoPersonalizadoStage) => void;
  onEliminar: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: campo.id,
    data: campo,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("touch-none", isDragging && "opacity-30")}
      {...attributes}
    >
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 group hover:border-stone-300 dark:hover:border-white/20 transition-all">
        <button
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5 text-stone-300 dark:text-stone-600 flex-shrink-0 hover:text-stone-500" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
              {campo.nombre}
            </span>
            {campo.requerido && (
              <span className="inline-flex items-center rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 flex-shrink-0">
                Requerido
              </span>
            )}
            {campo.bloqueado && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400 flex-shrink-0">
                <Lock className="h-2.5 w-2.5" />
                Bloqueado
              </span>
            )}
            <BadgeTipo tipo={campo.tipo} />
          </div>
          {campo.descripcion && (
            <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5 truncate">
              {campo.descripcion}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEditar(campo); }}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEliminar(campo.id); }}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/8 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CampoItemOverlay({ campo }: { campo: CampoPersonalizadoStage }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 border-lime-400/40 bg-white dark:bg-stone-900 shadow-xl rotate-1 opacity-95 w-[260px]">
      <GripVertical className="h-3.5 w-3.5 text-lime-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">{campo.nombre}</p>
        <p className="text-[10px] text-stone-400">{TIPO_LABEL[campo.tipo]}</p>
      </div>
    </div>
  );
}

// ── Zona droppable por stage ──────────────────────────────────────

function ZonaDropStage({
  stageId,
  stageColor,
  children,
}: {
  stageId: string;
  stageColor: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  const color = stageColor ?? "#818cf8";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[60px] space-y-1.5 rounded-xl transition-all duration-150",
        isOver && "ring-2 ring-offset-1 dark:ring-offset-stone-950"
      )}
      style={isOver ? { "--tw-ring-color": `${color}50` } as React.CSSProperties : undefined}
    >
      {isOver && (
        <div
          className="rounded-xl border-2 border-dashed py-2.5 text-center text-xs font-semibold transition-all"
          style={{ borderColor: `${color}60`, color, backgroundColor: `${color}0a` }}
        >
          Soltar para duplicar aquí
        </div>
      )}
      {children}
    </div>
  );
}

// ── Sección por stage ─────────────────────────────────────────────

interface SeccionStageProps {
  stage: { id: string; nombre: string; color: string | null };
  campos: CampoPersonalizadoStage[];
  pipelineId: string;
  onCampoGuardado: (campo: CampoPersonalizadoStage) => void;
  onCampoEliminado: (id: string) => void;
}

function SeccionStage({ stage, campos, pipelineId, onCampoGuardado, onCampoEliminado }: SeccionStageProps) {
  const [abierto, setAbierto] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [campoEditando, setCampoEditando] = useState<CampoPersonalizadoStage | null>(null);

  const handleEliminar = (id: string) => {
    onCampoEliminado(id);
    eliminarCampoStage(id).then((r) => {
      if (r.exito) toast.success("Campo eliminado");
      else toast.error(r.error);
    });
  };

  const abrirNuevo = () => { setCampoEditando(null); setDialogOpen(true); };
  const abrirEditar = (campo: CampoPersonalizadoStage) => { setCampoEditando(campo); setDialogOpen(true); };

  return (
    <div className="rounded-xl border border-stone-200 dark:border-white/10 overflow-hidden">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-stone-50 dark:bg-white/4 hover:bg-stone-100 dark:hover:bg-white/6 transition-colors text-left"
      >
        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0 ring-1 ring-white/20" style={{ backgroundColor: stage.color ?? "#818cf8" }} />
        <span className="flex-1 text-sm font-semibold text-stone-700 dark:text-stone-200">{stage.nombre}</span>
        <span className="text-xs text-stone-400 dark:text-stone-500">
          {campos.length} {campos.length === 1 ? "campo" : "campos"}
        </span>
        {abierto
          ? <ChevronDown className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
          : <ChevronRight className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
        }
      </button>

      {abierto && (
        <div className="px-3 py-2.5 bg-white dark:bg-transparent space-y-1.5">
          <ZonaDropStage stageId={stage.id} stageColor={stage.color}>
            {campos.length === 0 && (
              <p className="text-xs text-stone-400 dark:text-stone-500 italic py-1">
                Sin campos — arrastra uno desde otra etapa o agrega uno nuevo
              </p>
            )}
            {campos.map((campo) => (
              <CampoItem
                key={campo.id}
                campo={campo}
                onEditar={abrirEditar}
                onEliminar={handleEliminar}
              />
            ))}
          </ZonaDropStage>

          <button
            onClick={abrirNuevo}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border border-dashed border-stone-300 dark:border-white/12 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:border-stone-400 dark:hover:border-white/20 hover:bg-stone-50 dark:hover:bg-white/3 transition-all text-xs mt-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar campo
          </button>
        </div>
      )}

      <DialogCampo
        key={campoEditando?.id ?? "nuevo"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campoInicial={campoEditando}
        pipelineId={pipelineId}
        stageId={stage.id}
        onGuardado={onCampoGuardado}
      />
    </div>
  );
}

// ── Panel principal con DnD ───────────────────────────────────────

interface PanelConfigCamposProps {
  pipeline: PipelineConStages;
}

export function PanelConfigCampos({ pipeline }: PanelConfigCamposProps) {
  const [stagesState, setStagesState] = useState<Map<string, CampoPersonalizadoStage[]>>(() => {
    const map = new Map<string, CampoPersonalizadoStage[]>();
    for (const stage of pipeline.stages) {
      map.set(stage.id, (stage.campos ?? []) as CampoPersonalizadoStage[]);
    }
    return map;
  });
  const [activeCard, setActiveCard] = useState<CampoPersonalizadoStage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleCampoGuardado = (stageId: string, campo: CampoPersonalizadoStage) => {
    setStagesState((prev) => {
      const next = new Map(prev);
      const campos = next.get(stageId) ?? [];
      const idx = campos.findIndex((c) => c.id === campo.id);
      next.set(stageId, idx >= 0 ? campos.map((c) => (c.id === campo.id ? campo : c)) : [...campos, campo]);
      return next;
    });
  };

  const handleCampoEliminado = (stageId: string, id: string) => {
    setStagesState((prev) => {
      const next = new Map(prev);
      next.set(stageId, (next.get(stageId) ?? []).filter((c) => c.id !== id));
      return next;
    });
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveCard(active.data.current as CampoPersonalizadoStage);
  };

  const handleDragEnd = async ({ over, active }: DragEndEvent) => {
    setActiveCard(null);
    if (!over) return;

    const campo = active.data.current as CampoPersonalizadoStage;
    const targetStageId = over.id as string;

    if (campo.stageId === targetStageId) return;

    const targetCampos = stagesState.get(targetStageId) ?? [];
    if (targetCampos.some((c) => c.clave === campo.clave)) {
      toast.error(`La clave "${campo.clave}" ya existe en esa etapa`);
      return;
    }

    const resultado = await duplicarCampoStage(campo.id, targetStageId, pipeline.id);
    if (resultado.exito) {
      const targetStage = pipeline.stages.find((s) => s.id === targetStageId);
      setStagesState((prev) => {
        const next = new Map(prev);
        next.set(targetStageId, [
          ...(next.get(targetStageId) ?? []),
          {
            ...campo,
            id: resultado.id,
            stageId: targetStageId,
            pipelineId: pipeline.id,
          },
        ]);
        return next;
      });
      toast.success(`"${campo.nombre}" duplicado en "${targetStage?.nombre ?? targetStageId}"`);
    } else {
      toast.error(resultado.error);
    }
  };

  if (pipeline.stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
          Primero crea etapas en la pestaña "Etapas"
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-2 max-w-2xl">
        <p className="text-xs text-stone-400 dark:text-stone-500 mb-3">
          Arrastra un campo hacia otra etapa para duplicarlo. Los campos bloqueados son de solo lectura al editar una oportunidad.
        </p>
        {pipeline.stages.map((stage) => (
          <SeccionStage
            key={stage.id}
            stage={{ id: stage.id, nombre: stage.nombre, color: stage.color }}
            campos={stagesState.get(stage.id) ?? []}
            pipelineId={pipeline.id}
            onCampoGuardado={(campo) => handleCampoGuardado(stage.id, campo)}
            onCampoEliminado={(id) => handleCampoEliminado(stage.id, id)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150 }}>
        {activeCard && <CampoItemOverlay campo={activeCard} />}
      </DragOverlay>
    </DndContext>
  );
}
