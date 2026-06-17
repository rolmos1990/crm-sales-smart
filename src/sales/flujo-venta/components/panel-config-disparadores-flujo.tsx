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
  Clock,
  ChevronDown,
  ChevronRight,
  Zap,
  SlidersHorizontal,
  ArrowRightCircle,
  X,
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
  obtenerDisparadoresFlujoAction,
  crearDisparadorFlujo,
  actualizarDisparadorFlujo,
  toggleDisparadorFlujo,
  eliminarDisparadorFlujo,
  obtenerEtapasFlujoParaDisparadorAction,
} from "../disparadores/actions";
import { ETIQUETAS_TIPO } from "@/crm/pipeline/disparadores/types";
import type {
  TipoAccionDisparador,
  ConfigCrearTarea,
  ConfigCrearNota,
  ConfigWebhook,
  ConfigModificarCampo,
  ConfigCambiarEtapa,
} from "@/crm/pipeline/disparadores/types";
import type { DisparadorFlujo } from "../disparadores/types";
import { TIPOS_ACCION_FLUJO_VENTA } from "../disparadores/types";

// ── Íconos y colores por tipo ─────────────────────────────────────────────────

const ICONO_TIPO: Partial<Record<TipoAccionDisparador, React.ElementType>> = {
  CREAR_TAREA: CheckSquare,
  CREAR_NOTA: FileText,
  WEBHOOK: Webhook,
  MODIFICAR_CAMPO: SlidersHorizontal,
  CAMBIAR_ETAPA: ArrowRightCircle,
};

const COLOR_TIPO: Partial<Record<TipoAccionDisparador, string>> = {
  CREAR_TAREA: "#a3e635",
  CREAR_NOTA: "#60a5fa",
  WEBHOOK: "#c084fc",
  MODIFICAR_CAMPO: "#fb923c",
  CAMBIAR_ETAPA: "#f472b6",
};

// ── Conversión delay ──────────────────────────────────────────────────────────

type UnidadDelay = "minutos" | "horas" | "dias" | "semanas" | "meses";
const MULTIPLICADORES: Record<UnidadDelay, number> = {
  minutos: 1, horas: 60, dias: 1440, semanas: 10080, meses: 43200,
};
const ETIQUETAS_UNIDAD: Record<UnidadDelay, string> = {
  minutos: "minutos", horas: "horas", dias: "días", semanas: "semanas", meses: "meses",
};

function minutosAFrecuencia(mins: number): { frecuencia: string; unidad: UnidadDelay } {
  if (mins >= 43200 && mins % 43200 === 0) return { frecuencia: String(mins / 43200), unidad: "meses" };
  if (mins >= 10080 && mins % 10080 === 0) return { frecuencia: String(mins / 10080), unidad: "semanas" };
  if (mins >= 1440 && mins % 1440 === 0)   return { frecuencia: String(mins / 1440), unidad: "dias" };
  if (mins >= 60 && mins % 60 === 0)       return { frecuencia: String(mins / 60), unidad: "horas" };
  return { frecuencia: String(mins), unidad: "minutos" };
}

function formatearDelay(mins: number): string {
  if (mins >= 43200 && mins % 43200 === 0) { const n = mins / 43200; return `${n} mes${n !== 1 ? "es" : ""}`; }
  if (mins >= 10080 && mins % 10080 === 0) return `${mins / 10080}sem`;
  if (mins >= 1440 && mins % 1440 === 0)   return `${mins / 1440}d`;
  if (mins >= 60)                           return `${Math.round(mins / 60)}h`;
  return `${mins}m`;
}

// ── Tipos de etapa para UI ────────────────────────────────────────────────────

type EtapaOpcion = { id: string; nombre: string; color: string | null; orden: number };

// ── Fila de disparador ────────────────────────────────────────────────────────

function FilaDisparador({
  d,
  onEditar,
  onToggle,
  onEliminar,
}: {
  d: DisparadorFlujo;
  onEditar: (d: DisparadorFlujo) => void;
  onToggle: (id: string, activo: boolean) => void;
  onEliminar: (id: string) => void;
}) {
  const Icono = ICONO_TIPO[d.tipo] ?? Zap;
  const color = COLOR_TIPO[d.tipo] ?? "#a3e635";

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
      "bg-white dark:bg-white/5 border-stone-200 dark:border-white/10",
      !d.activo && "opacity-50",
      "hover:border-stone-300 dark:hover:border-white/20",
    )}>
      <div
        className="flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
      >
        <Icono className="h-3.5 w-3.5" style={{ color }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">{d.nombre}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          {ETIQUETAS_TIPO[d.tipo]}
          {d.delayMinutos ? (
            <span className="ml-2 inline-flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatearDelay(d.delayMinutos)}
            </span>
          ) : (
            <span className="ml-1.5 text-stone-300 dark:text-stone-600">· inmediato</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Switch checked={d.activo} onCheckedChange={(v) => onToggle(d.id, v)} className="scale-75" />
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

// ── Sección por etapa ─────────────────────────────────────────────────────────

function SeccionEtapa({
  etapa,
  disparadores,
  onAgregar,
  onEditar,
  onToggle,
  onEliminar,
}: {
  etapa: EtapaOpcion;
  disparadores: DisparadorFlujo[];
  onAgregar: (etapa: EtapaOpcion) => void;
  onEditar: (d: DisparadorFlujo) => void;
  onToggle: (id: string, activo: boolean) => void;
  onEliminar: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(true);
  const color = etapa.color ?? "#818cf8";

  return (
    <div className="rounded-xl border border-stone-200 dark:border-white/10 overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-stone-50/80 dark:bg-white/3 hover:bg-stone-100/80 dark:hover:bg-white/5 transition-colors"
      >
        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200 flex-1 text-left">
          {etapa.nombre}
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
            onClick={() => onAgregar(etapa)}
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

// ── Editor de encabezados webhook ─────────────────────────────────────────────

function EditorHeaders({
  headers,
  onChange,
}: {
  headers: { clave: string; valor: string }[];
  onChange: (h: { clave: string; valor: string }[]) => void;
}) {
  const agregar = () => onChange([...headers, { clave: "", valor: "" }]);
  const eliminar = (i: number) => onChange(headers.filter((_, idx) => idx !== i));
  const actualizar = (i: number, campo: "clave" | "valor", val: string) =>
    onChange(headers.map((h, idx) => (idx === i ? { ...h, [campo]: val } : h)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-stone-500 dark:text-stone-400">
          Encabezados personalizados
        </Label>
        <button
          type="button"
          onClick={agregar}
          className="text-xs text-lime-600 dark:text-lime-400 hover:underline flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Agregar
        </button>
      </div>
      {headers.length === 0 && (
        <p className="text-xs text-stone-400 italic">Sin encabezados adicionales</p>
      )}
      {headers.map((h, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <Input
            placeholder="Clave (ej. Authorization)"
            value={h.clave}
            onChange={(e) => actualizar(i, "clave", e.target.value)}
            className="flex-1 h-7 text-xs bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-lg font-mono"
          />
          <Input
            placeholder="Valor"
            value={h.valor}
            onChange={(e) => actualizar(i, "valor", e.target.value)}
            className="flex-1 h-7 text-xs bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-lg font-mono"
          />
          <button
            type="button"
            onClick={() => eliminar(i)}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-500/8 transition-colors flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Campos directos de Pedido disponibles para MODIFICAR_CAMPO ────────────────

const CAMPOS_DIRECTOS_PEDIDO: { clave: string; nombre: string }[] = [
  { clave: "notas", nombre: "Notas" },
  { clave: "moneda", nombre: "Moneda" },
];

// ── Dialog de formulario ──────────────────────────────────────────────────────

function DialogFormDisparadorFlujo({
  open,
  onOpenChange,
  etapa,
  flujoVentaId,
  inicial,
  etapasDisponibles,
  onGuardado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  etapa: EtapaOpcion | null;
  flujoVentaId: string;
  inicial: DisparadorFlujo | null;
  etapasDisponibles: EtapaOpcion[];
  onGuardado: (d: DisparadorFlujo) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoAccionDisparador>("CREAR_TAREA");
  const [delayMode, setDelayMode] = useState<"inmediato" | "programado">("inmediato");
  const [frecuencia, setFrecuencia] = useState("1");
  const [unidad, setUnidad] = useState<UnidadDelay>("horas");
  const [activo, setActivo] = useState(true);

  // Configs
  const [tareaTitle, setTareaTitle] = useState("");
  const [tareaDesc, setTareaDesc] = useState("");
  const [notaContenido, setNotaContenido] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookMethod, setWebhookMethod] = useState<"POST" | "GET">("POST");
  const [webhookHeaders, setWebhookHeaders] = useState<{ clave: string; valor: string }[]>([]);
  const [campoModo, setCampoModo] = useState<"campo_directo" | "metadata">("metadata");
  const [campoClave, setCampoClave] = useState("");
  const [campoValor, setCampoValor] = useState("");
  const [targetEtapaId, setTargetEtapaId] = useState("");

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (inicial) {
      setNombre(inicial.nombre);
      setTipo(inicial.tipo);
      setActivo(inicial.activo);

      if (inicial.delayMinutos) {
        setDelayMode("programado");
        const { frecuencia: f, unidad: u } = minutosAFrecuencia(inicial.delayMinutos);
        setFrecuencia(f);
        setUnidad(u);
      } else {
        setDelayMode("inmediato");
        setFrecuencia("1");
        setUnidad("horas");
      }

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
        const hdrs = c.headers ?? {};
        setWebhookHeaders(Object.entries(hdrs).map(([k, v]) => ({ clave: k, valor: v })));
      } else if (inicial.tipo === "MODIFICAR_CAMPO") {
        const c = cfg as ConfigModificarCampo;
        setCampoModo(c.modo ?? "metadata");
        setCampoClave(c.clave);
        setCampoValor(c.valor);
      } else if (inicial.tipo === "CAMBIAR_ETAPA") {
        const c = cfg as ConfigCambiarEtapa;
        setTargetEtapaId(c.stageId);
      }
    } else {
      setNombre("");
      setTipo("CREAR_TAREA");
      setDelayMode("inmediato");
      setFrecuencia("1");
      setUnidad("horas");
      setActivo(true);
      setTareaTitle(""); setTareaDesc("");
      setNotaContenido("");
      setWebhookUrl(""); setWebhookMethod("POST"); setWebhookHeaders([]);
      setCampoModo("metadata"); setCampoClave(""); setCampoValor("");
      setTargetEtapaId("");
    }
  }, [inicial, open]);

  const buildConfig = () => {
    if (tipo === "CREAR_TAREA") return { titulo: tareaTitle, descripcion: tareaDesc || undefined };
    if (tipo === "CREAR_NOTA") return { contenido: notaContenido };
    if (tipo === "WEBHOOK") {
      const headersObj = Object.fromEntries(
        webhookHeaders.filter((h) => h.clave.trim()).map((h) => [h.clave.trim(), h.valor]),
      );
      return { url: webhookUrl, method: webhookMethod, ...(Object.keys(headersObj).length > 0 && { headers: headersObj }) };
    }
    if (tipo === "MODIFICAR_CAMPO") return { modo: campoModo, clave: campoClave, valor: campoValor };
    if (tipo === "CAMBIAR_ETAPA") {
      const etapaTarget = etapasDisponibles.find((e) => e.id === targetEtapaId);
      // Reutilizamos stageId del config CRM para almacenar el flujoVentaEtapaId
      return { pipelineId: flujoVentaId, stageId: targetEtapaId, stageNombre: etapaTarget?.nombre };
    }
    return {};
  };

  const calcularDelayMinutos = (): number | null => {
    if (delayMode === "inmediato") return null;
    const minFrc = unidad === "minutos" ? 5 : 1;
    const n = Math.min(600, Math.max(minFrc, parseInt(frecuencia, 10) || minFrc));
    return n * MULTIPLICADORES[unidad];
  };

  const handleGuardar = () => {
    if (!etapa) return;
    const delayMinutos = calcularDelayMinutos();
    const datos = { nombre: nombre.trim(), tipo, activo, delayMinutos, config: buildConfig() };

    startTransition(async () => {
      const resultado = inicial
        ? await actualizarDisparadorFlujo(inicial.id, datos)
        : await crearDisparadorFlujo(flujoVentaId, etapa.id, datos);

      if (resultado.exito) {
        const id = inicial ? inicial.id : (resultado as { exito: true; id: string }).id;
        toast.success(inicial ? "Disparador actualizado" : "Disparador creado");
        onGuardado({
          id,
          nombre: datos.nombre,
          tipo,
          activo,
          delayMinutos,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: datos.config as any,
          orden: inicial?.orden ?? 0,
          flujoVentaEtapaId: etapa.id,
          flujoVentaId,
          creadoEn: inicial?.creadoEn ?? new Date(),
        });
        onOpenChange(false);
      } else {
        toast.error(resultado.error);
      }
    });
  };

  const esConfigValida = () => {
    if (tipo === "CREAR_TAREA") return tareaTitle.trim().length > 0;
    if (tipo === "CREAR_NOTA") return notaContenido.trim().length > 0;
    if (tipo === "WEBHOOK") return webhookUrl.trim().length > 0;
    if (tipo === "MODIFICAR_CAMPO") return campoClave.trim().length > 0;
    if (tipo === "CAMBIAR_ETAPA") return targetEtapaId.length > 0;
    return false;
  };

  const delayValido = delayMode === "inmediato" || ((calcularDelayMinutos() ?? 0) >= 5);
  const esValido = nombre.trim().length > 0 && esConfigValida() && delayValido;
  const minFrecuencia = unidad === "minutos" ? 5 : 1;

  const inputCls = "bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl";
  const inputInnerCls = "bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl";
  const labelCls = "text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1.5 block";
  const labelSmCls = "text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 block";
  const sectionCls = "space-y-3 rounded-xl border border-stone-200 dark:border-white/10 p-3 bg-stone-50/50 dark:bg-white/3";

  // Solo mostrar tipos válidos para flujo de venta
  const tiposDisponibles = (Object.entries(ETIQUETAS_TIPO) as [TipoAccionDisparador, string][])
    .filter(([val]) => TIPOS_ACCION_FLUJO_VENTA.includes(val as (typeof TIPOS_ACCION_FLUJO_VENTA)[number]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-stone-900 dark:text-stone-50 flex items-center gap-2">
            <Zap className="h-4 w-4 text-lime-500" />
            {inicial ? "Editar disparador" : "Nuevo disparador"}
          </DialogTitle>
          {etapa && (
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
              Etapa: <span className="font-medium">{etapa.nombre}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label className={labelCls}>Nombre</Label>
            <Input
              autoFocus
              placeholder="Ej. Notificar fulfillment"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <Label className={labelCls}>Acción</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAccionDisparador)}>
              <SelectTrigger className={inputCls}>
                <span className="flex items-center gap-2">
                  {(() => {
                    const Ic = ICONO_TIPO[tipo] ?? Zap;
                    return <Ic className="h-3.5 w-3.5 flex-shrink-0" style={{ color: COLOR_TIPO[tipo] ?? "#a3e635" }} />;
                  })()}
                  <span>{ETIQUETAS_TIPO[tipo]}</span>
                </span>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10 rounded-xl">
                {tiposDisponibles.map(([val, etq]) => {
                  const Ic = ICONO_TIPO[val] ?? Zap;
                  return (
                    <SelectItem key={val} value={val}>
                      <span className="flex items-center gap-2">
                        <Ic className="h-3.5 w-3.5" style={{ color: COLOR_TIPO[val] ?? "#a3e635" }} />
                        {etq}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {tipo === "CREAR_TAREA" && (
            <div className={sectionCls}>
              <div>
                <Label className={labelSmCls}>Título de la tarea</Label>
                <Input placeholder="Ej. Preparar envío" value={tareaTitle} onChange={(e) => setTareaTitle(e.target.value)} className={inputInnerCls} />
              </div>
              <div>
                <Label className={labelSmCls}>Descripción (opcional)</Label>
                <Textarea placeholder="Detalles de la tarea..." value={tareaDesc} onChange={(e) => setTareaDesc(e.target.value)} rows={2} className={`${inputInnerCls} resize-none text-sm`} />
              </div>
            </div>
          )}

          {tipo === "CREAR_NOTA" && (
            <div className={sectionCls.replace("space-y-3 ", "")}>
              <Label className={labelSmCls}>Contenido de la nota</Label>
              <Textarea placeholder="Ej. Pedido llegó a preparación. Revisar stock." value={notaContenido} onChange={(e) => setNotaContenido(e.target.value)} rows={3} className={`${inputInnerCls} resize-none text-sm`} />
            </div>
          )}

          {tipo === "WEBHOOK" && (
            <div className={sectionCls}>
              <div>
                <Label className={labelSmCls}>URL del webhook</Label>
                <Input placeholder="https://..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className={`${inputInnerCls} font-mono text-xs`} />
              </div>
              <div>
                <Label className={labelSmCls}>Método</Label>
                <Select value={webhookMethod} onValueChange={(v) => setWebhookMethod(v as "POST" | "GET")}>
                  <SelectTrigger className={`${inputInnerCls} w-28`}><span>{webhookMethod}</span></SelectTrigger>
                  <SelectContent className="bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10 rounded-xl">
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <EditorHeaders headers={webhookHeaders} onChange={setWebhookHeaders} />
            </div>
          )}

          {tipo === "MODIFICAR_CAMPO" && (
            <div className={sectionCls}>
              <div className="flex gap-2">
                {(["campo_directo", "metadata"] as const).map((modo) => (
                  <button
                    key={modo}
                    type="button"
                    onClick={() => { setCampoModo(modo); setCampoClave(""); setCampoValor(""); }}
                    className={cn(
                      "flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium transition-all",
                      campoModo === modo
                        ? "bg-lime-500/10 border-lime-500/30 text-lime-700 dark:bg-lime-400/10 dark:border-lime-400/30 dark:text-lime-400"
                        : "border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/5",
                    )}
                  >
                    {modo === "campo_directo" ? "Campo del pedido" : "Metadata (clave-valor)"}
                  </button>
                ))}
              </div>

              {campoModo === "campo_directo" && (
                <>
                  <div>
                    <Label className={labelSmCls}>Campo a modificar</Label>
                    <Select value={campoClave} onValueChange={(v) => { setCampoClave(v ?? ""); setCampoValor(""); }}>
                      <SelectTrigger className={inputInnerCls}>
                        {campoClave ? <span>{CAMPOS_DIRECTOS_PEDIDO.find((c) => c.clave === campoClave)?.nombre ?? campoClave}</span> : <SelectValue placeholder="Seleccionar campo..." />}
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10 rounded-xl">
                        {CAMPOS_DIRECTOS_PEDIDO.map((c) => (
                          <SelectItem key={c.clave} value={c.clave}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {campoClave && (
                    <div>
                      <Label className={labelSmCls}>Nuevo valor</Label>
                      <Input placeholder="Nuevo valor" value={campoValor} onChange={(e) => setCampoValor(e.target.value)} className={inputInnerCls} />
                    </div>
                  )}
                </>
              )}

              {campoModo === "metadata" && (
                <>
                  <div>
                    <Label className={labelSmCls}>Clave</Label>
                    <Input placeholder="Ej. estado_interno" value={campoClave} onChange={(e) => setCampoClave(e.target.value)} className={`${inputInnerCls} font-mono text-xs`} />
                  </div>
                  <div>
                    <Label className={labelSmCls}>Valor</Label>
                    <Input placeholder="Ej. listo" value={campoValor} onChange={(e) => setCampoValor(e.target.value)} className={inputInnerCls} />
                  </div>
                </>
              )}
            </div>
          )}

          {tipo === "CAMBIAR_ETAPA" && (
            <div className={sectionCls.replace("space-y-3 ", "")}>
              <Label className={labelSmCls}>Etapa destino</Label>
              {etapasDisponibles.length === 0 ? (
                <p className="text-xs text-stone-400 py-1">No hay otras etapas disponibles.</p>
              ) : (
                <Select value={targetEtapaId} onValueChange={(v) => setTargetEtapaId(v ?? "")}>
                  <SelectTrigger className={inputInnerCls}>
                    {targetEtapaId ? (
                      <span className="flex items-center gap-2">
                        {(() => {
                          const e = etapasDisponibles.find((e) => e.id === targetEtapaId);
                          return (
                            <>
                              {e?.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />}
                              <span>{e?.nombre ?? targetEtapaId}</span>
                            </>
                          );
                        })()}
                      </span>
                    ) : (
                      <SelectValue placeholder="Seleccionar etapa..." />
                    )}
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10 rounded-xl">
                    {etapasDisponibles
                      .filter((e) => e.id !== etapa?.id)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          <span className="flex items-center gap-2">
                            {e.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />}
                            {e.nombre}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className={labelCls}>Cuándo ejecutar</Label>
            <div className="flex gap-2">
              {(["inmediato", "programado"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDelayMode(mode)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-all",
                    delayMode === mode
                      ? "bg-lime-500/10 border-lime-500/30 text-lime-700 dark:bg-lime-400/10 dark:border-lime-400/30 dark:text-lime-400"
                      : "border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/5",
                  )}
                >
                  {mode === "inmediato" ? "Al llegar a esta etapa" : "Después de..."}
                </button>
              ))}
            </div>

            {delayMode === "programado" && (
              <div className="space-y-1.5">
                <div className="flex gap-2 items-center">
                  <div className="relative w-24 flex-shrink-0">
                    <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                    <Input
                      type="number"
                      min={minFrecuencia}
                      max={600}
                      step={1}
                      value={frecuencia}
                      onKeyDown={(e) => { if ([".", ",", "e", "E"].includes(e.key)) e.preventDefault(); }}
                      onChange={(e) => {
                        if (!e.target.value) { setFrecuencia(""); return; }
                        setFrecuencia(String(Math.min(600, Math.max(minFrecuencia, parseInt(e.target.value, 10) || minFrecuencia))));
                      }}
                      onBlur={() => setFrecuencia(String(Math.min(600, Math.max(minFrecuencia, parseInt(frecuencia, 10) || minFrecuencia))))}
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                  <Select value={unidad} onValueChange={(v) => {
                    const u = v as UnidadDelay;
                    setUnidad(u);
                    if (u === "minutos" && Number(frecuencia) < 5) setFrecuencia("5");
                  }}>
                    <SelectTrigger className={`${inputCls} flex-1`}><span>{ETIQUETAS_UNIDAD[unidad]}</span></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10 rounded-xl">
                      {(Object.entries(ETIQUETAS_UNIDAD) as [UnidadDelay, string][]).map(([val, etq]) => (
                        <SelectItem key={val} value={val}>{etq}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  {unidad === "minutos" ? "Mínimo 5 minutos · " : ""}Máximo 600
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">Activo</Label>
            <Switch checked={activo} onCheckedChange={setActivo} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleGuardar} disabled={!esValido || isPending} className="rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

type EtapaConDisparadores = {
  id: string;
  nombre: string;
  color: string | null;
  orden: number;
};

export function PanelConfigDisparadoresFlujo({
  flujoVenta,
}: {
  flujoVenta: { id: string; etapas: EtapaConDisparadores[] };
}) {
  const [disparadores, setDisparadores] = useState<DisparadorFlujo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [etapaParaAgregar, setEtapaParaAgregar] = useState<EtapaOpcion | null>(null);
  const [editando, setEditando] = useState<DisparadorFlujo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [etapasDisponibles, setEtapasDisponibles] = useState<EtapaOpcion[]>([]);

  useEffect(() => {
    obtenerDisparadoresFlujoAction(flujoVenta.id).then((ds) => {
      setDisparadores(ds);
      setCargando(false);
    });
    obtenerEtapasFlujoParaDisparadorAction(flujoVenta.id).then(setEtapasDisponibles);
  }, [flujoVenta.id]);

  const handleAgregar = (etapa: EtapaOpcion) => {
    setEtapaParaAgregar(etapa);
    setEditando(null);
    setDialogOpen(true);
  };

  const handleEditar = (d: DisparadorFlujo) => {
    const etapa = flujoVenta.etapas.find((e) => e.id === d.flujoVentaEtapaId) ?? null;
    setEtapaParaAgregar(etapa);
    setEditando(d);
    setDialogOpen(true);
  };

  const handleToggle = (id: string, activo: boolean) => {
    setDisparadores((prev) => prev.map((d) => (d.id === id ? { ...d, activo } : d)));
    toggleDisparadorFlujo(id, activo).then((r) => {
      if (!r.exito) {
        toast.error(r.error);
        setDisparadores((prev) => prev.map((d) => (d.id === id ? { ...d, activo: !activo } : d)));
      }
    });
  };

  const handleEliminar = (id: string) => {
    setDisparadores((prev) => prev.filter((d) => d.id !== id));
    eliminarDisparadorFlujo(id).then((r) => {
      if (r.exito) toast.success("Disparador eliminado");
      else toast.error(r.error);
    });
  };

  const handleGuardado = (nuevo: DisparadorFlujo) => {
    setDisparadores((prev) => {
      const existe = prev.find((d) => d.id === nuevo.id);
      if (existe) return prev.map((d) => (d.id === nuevo.id ? nuevo : d));
      return [...prev, nuevo];
    });
  };

  const totalActivos = disparadores.filter((d) => d.activo).length;
  const etapas = flujoVenta.etapas;

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="flex items-start gap-3 rounded-xl border border-lime-500/20 dark:border-lime-400/15 bg-lime-500/5 dark:bg-lime-400/5 px-4 py-3">
        <Zap className="h-4 w-4 text-lime-600 dark:text-lime-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
            Disparadores de automatización
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Cada vez que un pedido llegue a una etapa, los disparadores activos se ejecutan
            automáticamente según el tiempo configurado.
          </p>
        </div>
        {totalActivos > 0 && (
          <span className="flex-shrink-0 ml-auto inline-flex items-center gap-1 rounded-lg bg-lime-500/15 border border-lime-500/25 px-2 py-0.5 text-xs font-semibold text-lime-700 dark:text-lime-400">
            <Zap className="h-3 w-3" />
            {totalActivos} activos
          </span>
        )}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      ) : etapas.length === 0 ? (
        <p className="text-sm text-stone-400 dark:text-stone-600 text-center py-8">
          Este flujo no tiene etapas todavía.
        </p>
      ) : (
        <div className="space-y-2">
          {etapas.map((etapa) => (
            <SeccionEtapa
              key={etapa.id}
              etapa={etapa}
              disparadores={disparadores.filter((d) => d.flujoVentaEtapaId === etapa.id)}
              onAgregar={handleAgregar}
              onEditar={handleEditar}
              onToggle={handleToggle}
              onEliminar={handleEliminar}
            />
          ))}
        </div>
      )}

      <DialogFormDisparadorFlujo
        open={dialogOpen}
        onOpenChange={(v) => {
          if (!v) { setDialogOpen(false); setEditando(null); setEtapaParaAgregar(null); }
          else setDialogOpen(v);
        }}
        etapa={etapaParaAgregar}
        flujoVentaId={flujoVenta.id}
        inicial={editando}
        etapasDisponibles={etapasDisponibles}
        onGuardado={handleGuardado}
      />
    </div>
  );
}
