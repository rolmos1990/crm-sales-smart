"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckSquare,
  FileText,
  Webhook,
  UserCheck,
  Clock,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  obtenerDisparadoresAction,
  crearDisparador,
  actualizarDisparador,
  toggleDisparador,
  eliminarDisparador,
} from "../disparadores/actions";
import {
  ETIQUETAS_TIPO,
  type Disparador,
  type TipoAccionDisparador,
  type ConfigCrearTarea,
  type ConfigCrearNota,
  type ConfigWebhook,
  type ConfigAsignarUsuario,
} from "../disparadores/types";
import type { PipelineConStages, PipelineStage } from "../types";

// ── Icono por tipo ────────────────────────────────────────────────

const ICONO_TIPO: Record<TipoAccionDisparador, React.ElementType> = {
  CREAR_TAREA: CheckSquare,
  CREAR_NOTA: FileText,
  WEBHOOK: Webhook,
  ASIGNAR_USUARIO: UserCheck,
};

const COLOR_TIPO: Record<TipoAccionDisparador, string> = {
  CREAR_TAREA: "#a3e635",
  CREAR_NOTA: "#60a5fa",
  WEBHOOK: "#c084fc",
  ASIGNAR_USUARIO: "#fbbf24",
};

// ── Fila de disparador ────────────────────────────────────────────

function FilaDisparador({
  d,
  onEditar,
  onToggle,
  onEliminar,
}: {
  d: Disparador;
  onEditar: (d: Disparador) => void;
  onToggle: (id: string, activo: boolean) => void;
  onEliminar: (id: string) => void;
}) {
  const Icono = ICONO_TIPO[d.tipo];
  const color = COLOR_TIPO[d.tipo];

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
        "bg-white dark:bg-white/5 border-stone-200 dark:border-white/10",
        !d.activo && "opacity-50",
        "hover:border-stone-300 dark:hover:border-white/20"
      )}
    >
      <div
        className="flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
      >
        <Icono className="h-3.5 w-3.5" style={{ color }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
          {d.nombre}
        </p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          {ETIQUETAS_TIPO[d.tipo]}
          {d.delayMinutos ? (
            <span className="ml-2 inline-flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {d.delayMinutos < 60
                ? `${d.delayMinutos}m`
                : `${Math.round(d.delayMinutos / 60)}h`}
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Switch
          checked={d.activo}
          onCheckedChange={(v) => onToggle(d.id, v)}
          className="scale-75"
        />
        <button
          onClick={() => onEditar(d)}
          className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onEliminar(d.id)}
          className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/8 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Sección de stage ──────────────────────────────────────────────

function SeccionStage({
  stage,
  disparadores,
  onAgregar,
  onEditar,
  onToggle,
  onEliminar,
}: {
  stage: PipelineStage;
  disparadores: Disparador[];
  onAgregar: (stage: PipelineStage) => void;
  onEditar: (d: Disparador) => void;
  onToggle: (id: string, activo: boolean) => void;
  onEliminar: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(true);
  const color = stage.color ?? "#818cf8";

  return (
    <div className="rounded-xl border border-stone-200 dark:border-white/10 overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-stone-50/80 dark:bg-white/3 hover:bg-stone-100/80 dark:hover:bg-white/5 transition-colors"
      >
        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200 flex-1 text-left">
          {stage.nombre}
        </span>
        {disparadores.length > 0 && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-md bg-stone-200 dark:bg-white/10 text-xs font-bold text-stone-600 dark:text-stone-400">
            {disparadores.length}
          </span>
        )}
        {abierto ? (
          <ChevronDown className="h-4 w-4 text-stone-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-stone-400 flex-shrink-0" />
        )}
      </button>

      {abierto && (
        <div className="px-3 pb-3 pt-2 space-y-1.5 bg-white dark:bg-transparent">
          {disparadores.length === 0 ? (
            <p className="text-xs text-stone-400 dark:text-stone-600 py-2 text-center">
              Sin disparadores para esta etapa
            </p>
          ) : (
            disparadores.map((d) => (
              <FilaDisparador
                key={d.id}
                d={d}
                onEditar={onEditar}
                onToggle={onToggle}
                onEliminar={onEliminar}
              />
            ))
          )}
          <button
            onClick={() => onAgregar(stage)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-stone-300 dark:border-white/12 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:border-stone-400 dark:hover:border-white/20 hover:bg-stone-50 dark:hover:bg-white/3 transition-all text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar disparador
          </button>
        </div>
      )}
    </div>
  );
}

// ── Dialog de formulario ──────────────────────────────────────────

function DialogFormDisparador({
  open,
  onOpenChange,
  stage,
  pipeline,
  inicial,
  onGuardado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stage: PipelineStage | null;
  pipeline: PipelineConStages;
  inicial: Disparador | null;
  onGuardado: (d: Disparador) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoAccionDisparador>("CREAR_TAREA");
  const [delayMinutos, setDelayMinutos] = useState<string>("");
  const [activo, setActivo] = useState(true);
  // config fields
  const [tareaTitle, setTareaTitle] = useState("");
  const [tareaDesc, setTareaDesc] = useState("");
  const [notaContenido, setNotaContenido] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookMethod, setWebhookMethod] = useState<"POST" | "GET">("POST");
  const [usuarioId, setUsuarioId] = useState("");

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (inicial) {
      setNombre(inicial.nombre);
      setTipo(inicial.tipo);
      setDelayMinutos(inicial.delayMinutos != null ? String(inicial.delayMinutos) : "");
      setActivo(inicial.activo);
      const cfg = inicial.config;
      if (inicial.tipo === "CREAR_TAREA") {
        const c = cfg as ConfigCrearTarea;
        setTareaTitle(c.titulo);
        setTareaDesc(c.descripcion ?? "");
      } else if (inicial.tipo === "CREAR_NOTA") {
        setNotaContenido((cfg as ConfigCrearNota).contenido);
      } else if (inicial.tipo === "WEBHOOK") {
        const c = cfg as ConfigWebhook;
        setWebhookUrl(c.url);
        setWebhookMethod(c.method ?? "POST");
      } else if (inicial.tipo === "ASIGNAR_USUARIO") {
        setUsuarioId((cfg as ConfigAsignarUsuario).usuarioId);
      }
    } else {
      setNombre("");
      setTipo("CREAR_TAREA");
      setDelayMinutos("");
      setActivo(true);
      setTareaTitle("");
      setTareaDesc("");
      setNotaContenido("");
      setWebhookUrl("");
      setWebhookMethod("POST");
      setUsuarioId("");
    }
  }, [inicial, open]);

  const buildConfig = () => {
    if (tipo === "CREAR_TAREA") return { titulo: tareaTitle, descripcion: tareaDesc || undefined };
    if (tipo === "CREAR_NOTA") return { contenido: notaContenido };
    if (tipo === "WEBHOOK") return { url: webhookUrl, method: webhookMethod };
    return { usuarioId };
  };

  const handleGuardar = () => {
    if (!stage) return;
    const datos = {
      nombre: nombre.trim(),
      tipo,
      activo,
      delayMinutos: delayMinutos ? Number(delayMinutos) : null,
      config: buildConfig(),
    };

    startTransition(async () => {
      const resultado = inicial
        ? await actualizarDisparador(inicial.id, datos)
        : await crearDisparador(pipeline.id, stage.id, datos);

      if (resultado.exito) {
        const id = inicial ? inicial.id : (resultado as { exito: true; id: string }).id;
        toast.success(inicial ? "Disparador actualizado" : "Disparador creado");
        onGuardado({
          id,
          nombre: datos.nombre,
          tipo,
          activo,
          delayMinutos: datos.delayMinutos,
          config: datos.config as Disparador["config"],
          orden: inicial?.orden ?? 0,
          stageId: stage.id,
          pipelineId: pipeline.id,
          creadoEn: inicial?.creadoEn ?? new Date(),
        });
        onOpenChange(false);
      } else {
        toast.error(resultado.error);
      }
    });
  };

  const esValido = nombre.trim().length > 0 && (
    tipo === "CREAR_TAREA" ? tareaTitle.trim().length > 0 :
    tipo === "CREAR_NOTA" ? notaContenido.trim().length > 0 :
    tipo === "WEBHOOK" ? webhookUrl.trim().length > 0 :
    usuarioId.trim().length > 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="text-stone-900 dark:text-stone-50 flex items-center gap-2">
            <Zap className="h-4 w-4 text-lime-500" />
            {inicial ? "Editar disparador" : "Nuevo disparador"}
          </DialogTitle>
          {stage && (
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
              Etapa: <span className="font-medium">{stage.nombre}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Nombre */}
          <div>
            <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1.5 block">
              Nombre
            </Label>
            <Input
              autoFocus
              placeholder="Ej. Enviar recordatorio"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
            />
          </div>

          {/* Tipo */}
          <div>
            <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1.5 block">
              Acción
            </Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAccionDisparador)}>
              <SelectTrigger className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10 rounded-xl">
                {(Object.entries(ETIQUETAS_TIPO) as [TipoAccionDisparador, string][]).map(([val, etq]) => {
                  const Ic = ICONO_TIPO[val];
                  return (
                    <SelectItem key={val} value={val}>
                      <span className="flex items-center gap-2">
                        <Ic className="h-3.5 w-3.5" style={{ color: COLOR_TIPO[val] }} />
                        {etq}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Config por tipo */}
          {tipo === "CREAR_TAREA" && (
            <div className="space-y-3 rounded-xl border border-stone-200 dark:border-white/10 p-3 bg-stone-50/50 dark:bg-white/3">
              <div>
                <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 block">
                  Título de la tarea
                </Label>
                <Input
                  placeholder="Ej. Hacer seguimiento al cliente"
                  value={tareaTitle}
                  onChange={(e) => setTareaTitle(e.target.value)}
                  className="bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 block">
                  Descripción (opcional)
                </Label>
                <Textarea
                  placeholder="Detalles de la tarea..."
                  value={tareaDesc}
                  onChange={(e) => setTareaDesc(e.target.value)}
                  rows={2}
                  className="bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl resize-none text-sm"
                />
              </div>
            </div>
          )}

          {tipo === "CREAR_NOTA" && (
            <div className="rounded-xl border border-stone-200 dark:border-white/10 p-3 bg-stone-50/50 dark:bg-white/3">
              <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 block">
                Contenido de la nota
              </Label>
              <Textarea
                placeholder="Ej. El cliente pasó a propuesta. Revisar condiciones."
                value={notaContenido}
                onChange={(e) => setNotaContenido(e.target.value)}
                rows={3}
                className="bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl resize-none text-sm"
              />
            </div>
          )}

          {tipo === "WEBHOOK" && (
            <div className="space-y-3 rounded-xl border border-stone-200 dark:border-white/10 p-3 bg-stone-50/50 dark:bg-white/3">
              <div>
                <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 block">
                  URL del webhook
                </Label>
                <Input
                  placeholder="https://..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 block">
                  Método
                </Label>
                <Select
                  value={webhookMethod}
                  onValueChange={(v) => setWebhookMethod(v as "POST" | "GET")}
                >
                  <SelectTrigger className="bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10 rounded-xl">
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {tipo === "ASIGNAR_USUARIO" && (
            <div className="rounded-xl border border-stone-200 dark:border-white/10 p-3 bg-stone-50/50 dark:bg-white/3">
              <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 block">
                ID del usuario a asignar
              </Label>
              <Input
                placeholder="ID del usuario"
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value)}
                className="bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
              />
            </div>
          )}

          {/* Delay + Activo */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1.5 block">
                Delay (minutos)
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                <Input
                  type="number"
                  min={0}
                  max={10080}
                  placeholder="Inmediato"
                  value={delayMinutos}
                  onChange={(e) => setDelayMinutos(e.target.value)}
                  className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl pl-8"
                />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 pb-1">
              <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                Activo
              </Label>
              <Switch checked={activo} onCheckedChange={setActivo} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleGuardar}
            disabled={!esValido || isPending}
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

// ── Panel principal ───────────────────────────────────────────────

export function PanelConfigDisparadores({ pipeline }: { pipeline: PipelineConStages }) {
  const [disparadores, setDisparadores] = useState<Disparador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [stageParaAgregar, setStageParaAgregar] = useState<PipelineStage | null>(null);
  const [editando, setEditando] = useState<Disparador | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    obtenerDisparadoresAction(pipeline.id).then((ds) => {
      setDisparadores(ds);
      setCargando(false);
    });
  }, [pipeline.id]);

  const handleAgregar = (stage: PipelineStage) => {
    setStageParaAgregar(stage);
    setEditando(null);
    setDialogOpen(true);
  };

  const handleEditar = (d: Disparador) => {
    const stage = pipeline.stages.find((s) => s.id === d.stageId) ?? null;
    setStageParaAgregar(stage);
    setEditando(d);
    setDialogOpen(true);
  };

  const handleToggle = (id: string, activo: boolean) => {
    setDisparadores((prev) => prev.map((d) => (d.id === id ? { ...d, activo } : d)));
    toggleDisparador(id, activo).then((r) => {
      if (!r.exito) {
        toast.error(r.error);
        setDisparadores((prev) => prev.map((d) => (d.id === id ? { ...d, activo: !activo } : d)));
      }
    });
  };

  const handleEliminar = (id: string) => {
    setDisparadores((prev) => prev.filter((d) => d.id !== id));
    eliminarDisparador(id).then((r) => {
      if (r.exito) toast.success("Disparador eliminado");
      else toast.error(r.error);
    });
  };

  const handleGuardado = (nuevo: Disparador) => {
    setDisparadores((prev) => {
      const existe = prev.find((d) => d.id === nuevo.id);
      if (existe) return prev.map((d) => (d.id === nuevo.id ? nuevo : d));
      return [...prev, nuevo];
    });
  };

  const stageActual = stageParaAgregar;
  const totalActivos = disparadores.filter((d) => d.activo).length;

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Encabezado informativo */}
      <div className="flex items-start gap-3 rounded-xl border border-lime-500/20 dark:border-lime-400/15 bg-lime-500/5 dark:bg-lime-400/5 px-4 py-3">
        <Zap className="h-4 w-4 text-lime-600 dark:text-lime-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
            Disparadores de automatización
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Cada vez que una oportunidad llegue a una etapa, los disparadores activos se ejecutan
            automáticamente según el delay configurado.
          </p>
        </div>
        {totalActivos > 0 && (
          <span className="flex-shrink-0 ml-auto inline-flex items-center gap-1 rounded-lg bg-lime-500/15 border border-lime-500/25 px-2 py-0.5 text-xs font-semibold text-lime-700 dark:text-lime-400">
            <Zap className="h-3 w-3" />
            {totalActivos} activos
          </span>
        )}
      </div>

      {/* Lista por stage */}
      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      ) : pipeline.stages.length === 0 ? (
        <p className="text-sm text-stone-400 dark:text-stone-600 text-center py-8">
          Este pipeline no tiene etapas todavía.
        </p>
      ) : (
        <div className="space-y-2">
          {pipeline.stages.map((stage) => (
            <SeccionStage
              key={stage.id}
              stage={stage}
              disparadores={disparadores.filter((d) => d.stageId === stage.id)}
              onAgregar={handleAgregar}
              onEditar={handleEditar}
              onToggle={handleToggle}
              onEliminar={handleEliminar}
            />
          ))}
        </div>
      )}

      <DialogFormDisparador
        open={dialogOpen}
        onOpenChange={(v) => { if (!v) { setDialogOpen(false); setEditando(null); setStageParaAgregar(null); } else setDialogOpen(v); }}
        stage={stageActual}
        pipeline={pipeline}
        inicial={editando}
        onGuardado={handleGuardado}
      />
    </div>
  );
}
