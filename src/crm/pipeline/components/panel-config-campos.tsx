"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Eye,
  EyeOff,
  Lock,
  ToggleLeft,
  Power,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  crearCampoPipeline,
  actualizarCampoPipeline,
  eliminarCampo,
  toggleEstadoCampo,
} from "../actions";
import type { PipelineConStages, CampoPersonalizadoPipeline, PipelineStage, TipoCampo } from "../types";

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

// ── Helpers visuales ──────────────────────────────────────────────

function BadgeTipo({ tipo }: { tipo: TipoCampo }) {
  return (
    <span className="inline-flex items-center rounded-md bg-stone-100 dark:bg-white/8 border border-stone-200 dark:border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 dark:text-stone-400 whitespace-nowrap">
      {TIPO_LABEL[tipo]}
    </span>
  );
}

function BadgesEtapas({
  stageIds,
  stages,
  color,
}: {
  stageIds: string[];
  stages: PipelineStage[];
  color: string;
}) {
  if (stageIds.length === 0) return <span className="text-xs text-stone-400 dark:text-stone-600">—</span>;

  const todos = stages.every((s) => stageIds.includes(s.id));
  if (todos) return (
    <span className={cn("text-xs font-medium", color)}>Todas</span>
  );

  const nombres = stages
    .filter((s) => stageIds.includes(s.id))
    .map((s) => s.nombre);

  if (nombres.length <= 2) {
    return (
      <div className="flex flex-wrap gap-1">
        {nombres.map((n) => (
          <span key={n} className="inline-flex items-center rounded-md bg-stone-100 dark:bg-white/6 border border-stone-200 dark:border-white/10 px-1.5 py-0.5 text-[10px] text-stone-600 dark:text-stone-400 whitespace-nowrap">
            {n}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {nombres.slice(0, 1).map((n) => (
        <span key={n} className="inline-flex items-center rounded-md bg-stone-100 dark:bg-white/6 border border-stone-200 dark:border-white/10 px-1.5 py-0.5 text-[10px] text-stone-600 dark:text-stone-400 whitespace-nowrap">
          {n}
        </span>
      ))}
      <span className="inline-flex items-center rounded-md bg-stone-100 dark:bg-white/6 border border-stone-200 dark:border-white/10 px-1.5 py-0.5 text-[10px] text-stone-500 dark:text-stone-500 whitespace-nowrap">
        +{nombres.length - 1}
      </span>
    </div>
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

// ── Tabla de comportamiento por etapa ─────────────────────────────

interface ReglasPorEtapa {
  visibleEn: string[];
  requeridoEn: string[];
  bloqueadoEn: string[];
}

function TablaComportamientoEtapa({
  stages,
  reglas,
  onChange,
}: {
  stages: PipelineStage[];
  reglas: ReglasPorEtapa;
  onChange: (r: ReglasPorEtapa) => void;
}) {
  const toggle = (field: keyof ReglasPorEtapa, stageId: string) => {
    const arr = reglas[field];
    const next = arr.includes(stageId) ? arr.filter((id) => id !== stageId) : [...arr, stageId];
    onChange({ ...reglas, [field]: next });
  };

  const toggleAll = (field: keyof ReglasPorEtapa) => {
    const all = stages.map((s) => s.id);
    const current = reglas[field];
    const isAll = all.every((id) => current.includes(id));
    onChange({ ...reglas, [field]: isAll ? [] : all });
  };

  const allVisible = stages.every((s) => reglas.visibleEn.includes(s.id));
  const allRequerido = stages.every((s) => reglas.requeridoEn.includes(s.id));
  const allBloqueado = stages.every((s) => reglas.bloqueadoEn.includes(s.id));

  return (
    <div className="rounded-xl border border-stone-200 dark:border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-50 dark:bg-white/4 border-b border-stone-200 dark:border-white/10">
            <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
              Etapa
            </th>
            <th className="px-2 py-2 text-center">
              <button
                onClick={() => toggleAll("visibleEn")}
                title="Visible en todas"
                className="flex flex-col items-center gap-0.5 mx-auto group"
              >
                <Eye className={cn("h-3.5 w-3.5 transition-colors", allVisible ? "text-lime-500" : "text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300")} />
                <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wide">Visible</span>
              </button>
            </th>
            <th className="px-2 py-2 text-center">
              <button
                onClick={() => toggleAll("requeridoEn")}
                title="Requerido en todas"
                className="flex flex-col items-center gap-0.5 mx-auto group"
              >
                <ToggleLeft className={cn("h-3.5 w-3.5 transition-colors", allRequerido ? "text-amber-500" : "text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300")} />
                <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wide">Requerido</span>
              </button>
            </th>
            <th className="px-2 py-2 text-center">
              <button
                onClick={() => toggleAll("bloqueadoEn")}
                title="Bloqueado en todas"
                className="flex flex-col items-center gap-0.5 mx-auto group"
              >
                <Lock className={cn("h-3.5 w-3.5 transition-colors", allBloqueado ? "text-orange-500" : "text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300")} />
                <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wide">Bloqueado</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {stages.map((stage, i) => {
            const visible = reglas.visibleEn.includes(stage.id);
            const requerido = reglas.requeridoEn.includes(stage.id);
            const bloqueado = reglas.bloqueadoEn.includes(stage.id);
            return (
              <tr
                key={stage.id}
                className={cn(
                  "border-b border-stone-100 dark:border-white/6 last:border-0 transition-colors",
                  i % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-stone-50/50 dark:bg-white/2"
                )}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color ?? "#818cf8" }} />
                    <span className="text-xs font-medium text-stone-700 dark:text-stone-300">{stage.nombre}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center">
                  <CheckCell
                    active={visible}
                    color="lime"
                    onClick={() => toggle("visibleEn", stage.id)}
                    icon={visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <CheckCell
                    active={requerido}
                    color="amber"
                    onClick={() => toggle("requeridoEn", stage.id)}
                    disabled={!visible}
                    icon={<ToggleLeft className="h-3.5 w-3.5" />}
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <CheckCell
                    active={bloqueado}
                    color="orange"
                    onClick={() => toggle("bloqueadoEn", stage.id)}
                    disabled={!visible}
                    icon={<Lock className="h-3.5 w-3.5" />}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Resumen */}
      <div className="px-3 py-2 bg-stone-50 dark:bg-white/3 border-t border-stone-200 dark:border-white/10">
        <p className="text-[10px] text-stone-400 dark:text-stone-500 leading-relaxed">
          {reglas.requeridoEn.length > 0 && (
            <span>El campo será requerido en {stages.filter(s => reglas.requeridoEn.includes(s.id)).map(s => s.nombre).join(" y ")}. </span>
          )}
          {reglas.bloqueadoEn.length > 0 && (
            <span>El campo estará bloqueado (solo lectura) en {stages.filter(s => reglas.bloqueadoEn.includes(s.id)).map(s => s.nombre).join(" y ")}.</span>
          )}
          {reglas.requeridoEn.length === 0 && reglas.bloqueadoEn.length === 0 && (
            <span>Sin reglas de obligatoriedad o bloqueo configuradas.</span>
          )}
        </p>
      </div>
    </div>
  );
}

function CheckCell({
  active,
  color,
  onClick,
  disabled,
  icon,
}: {
  active: boolean;
  color: "lime" | "amber" | "orange";
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
}) {
  const colors = {
    lime:   { active: "text-lime-500 dark:text-lime-400",   bg: "bg-lime-500/10" },
    amber:  { active: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10" },
    orange: { active: "text-orange-500 dark:text-orange-400", bg: "bg-orange-500/10" },
  }[color];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-6 w-6 mx-auto flex items-center justify-center rounded-md transition-all",
        active && !disabled ? `${colors.active} ${colors.bg}` : "text-stone-300 dark:text-stone-700",
        disabled && "opacity-30 cursor-not-allowed",
        !active && !disabled && "hover:text-stone-500 dark:hover:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/8"
      )}
    >
      {icon}
    </button>
  );
}

// ── Panel de edición lateral ──────────────────────────────────────

interface DatosFormCampo {
  nombre: string;
  clave: string;
  tipo: TipoCampo;
  descripcion: string;
  opciones: string[];
  visibleEn: string[];
  requeridoEn: string[];
  bloqueadoEn: string[];
}

function PanelEditarCampo({
  campo,
  stages,
  pipelineId,
  onGuardado,
  onCerrar,
}: {
  campo: CampoPersonalizadoPipeline | null;
  stages: PipelineStage[];
  pipelineId: string;
  onGuardado: (campo: CampoPersonalizadoPipeline) => void;
  onCerrar: () => void;
}) {
  const esNuevo = campo === null;
  const [form, setForm] = useState<DatosFormCampo>(() => ({
    nombre:      campo?.nombre      ?? "",
    clave:       campo?.clave       ?? "",
    tipo:        campo?.tipo        ?? "TEXTO",
    descripcion: campo?.descripcion ?? "",
    opciones:    campo?.opciones    ?? [],
    visibleEn:   campo?.visibleEn   ?? stages.map((s) => s.id),
    requeridoEn: campo?.requeridoEn ?? [],
    bloqueadoEn: campo?.bloqueadoEn ?? [],
  }));
  const [claveManual, setClaveManual] = useState(!esNuevo);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForm({
      nombre:      campo?.nombre      ?? "",
      clave:       campo?.clave       ?? "",
      tipo:        campo?.tipo        ?? "TEXTO",
      descripcion: campo?.descripcion ?? "",
      opciones:    campo?.opciones    ?? [],
      visibleEn:   campo?.visibleEn   ?? stages.map((s) => s.id),
      requeridoEn: campo?.requeridoEn ?? [],
      bloqueadoEn: campo?.bloqueadoEn ?? [],
    });
    setClaveManual(!esNuevo);
  }, [campo]);

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
      descripcion: form.descripcion.trim() || null,
      opciones:    conOpciones && form.opciones.length > 0 ? form.opciones : null,
      visibleEn:   form.visibleEn,
      requeridoEn: form.requeridoEn,
      bloqueadoEn: form.bloqueadoEn,
    };

    startTransition(async () => {
      if (esNuevo) {
        const r = await crearCampoPipeline(pipelineId, datos);
        if (r.exito) {
          toast.success("Campo creado");
          onGuardado({
            id: r.id,
            nombre:      datos.nombre,
            clave:       datos.clave,
            tipo:        datos.tipo,
            descripcion: datos.descripcion,
            opciones:    datos.opciones,
            orden:       0,
            activo:      true,
            pipelineId,
            visibleEn:   datos.visibleEn,
            requeridoEn: datos.requeridoEn,
            bloqueadoEn: datos.bloqueadoEn,
          });
        } else {
          toast.error(r.error);
        }
      } else {
        const r = await actualizarCampoPipeline(campo!.id, datos);
        if (r.exito) {
          toast.success("Campo actualizado");
          onGuardado({ ...campo!, ...datos });
        } else {
          toast.error(r.error);
        }
      }
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-white/10">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          {esNuevo ? "Nuevo campo" : "Editar campo"}
        </h3>
        <button
          onClick={onCerrar}
          className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Formulario con scroll */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Información general */}
        <div>
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-3">
            Información general
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-600 dark:text-stone-400">Nombre del campo</Label>
              <Input
                autoFocus
                value={form.nombre}
                onChange={(e) => handleNombreChange(e.target.value)}
                placeholder="ej. Presupuesto estimado"
                className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-600 dark:text-stone-400">Clave (identificador único)</Label>
              <Input
                value={form.clave}
                onChange={(e) => {
                  setClaveManual(true);
                  setField("clave", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                }}
                placeholder="presupuesto_estimado"
                className="font-mono text-sm bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9"
              />
              <p className="text-[10px] text-stone-400 dark:text-stone-500">
                Solo minúsculas, números y guiones bajos.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-600 dark:text-stone-400">Tipo de dato</Label>
              <Select value={form.tipo} onValueChange={(v) => setField("tipo", v as TipoCampo)}>
                <SelectTrigger className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9 text-sm">
                  <span>{TIPO_LABEL[form.tipo]}</span>
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
              <Label className="text-xs font-medium text-stone-600 dark:text-stone-400">Descripción (opcional)</Label>
              <Input
                value={form.descripcion}
                onChange={(e) => setField("descripcion", e.target.value)}
                placeholder="Ayuda al equipo a saber qué ingresar"
                className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Comportamiento por etapa */}
        {stages.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                Comportamiento por etapa
              </p>
            </div>
            <TablaComportamientoEtapa
              stages={stages}
              reglas={{ visibleEn: form.visibleEn, requeridoEn: form.requeridoEn, bloqueadoEn: form.bloqueadoEn }}
              onChange={(r) => setForm((prev) => ({ ...prev, ...r }))}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-stone-200 dark:border-white/10 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCerrar} className="rounded-xl">
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleGuardar}
          disabled={!form.nombre.trim() || !form.clave.trim() || isPending}
          className="rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950 shadow-sm"
        >
          {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}

// ── Fila de campo en la tabla ─────────────────────────────────────

function FilaCampo({
  campo,
  stages,
  activo,
  onEditar,
  onEliminar,
  onToggleEstado,
}: {
  campo: CampoPersonalizadoPipeline;
  stages: PipelineStage[];
  activo: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  onToggleEstado: () => void;
}) {
  return (
    <tr className="group border-b border-stone-100 dark:border-white/6 last:border-0 hover:bg-stone-50 dark:hover:bg-white/3 transition-colors">
      {/* Campo */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", activo ? "bg-lime-500" : "bg-stone-300 dark:bg-stone-600")} />
          <div>
            <p className={cn("text-sm font-medium leading-tight", activo ? "text-stone-800 dark:text-stone-200" : "text-stone-400 dark:text-stone-600")}>
              {campo.nombre}
            </p>
            <p className="text-[11px] text-stone-400 dark:text-stone-600 font-mono">{campo.clave}</p>
          </div>
        </div>
      </td>

      {/* Tipo */}
      <td className="px-3 py-3">
        <BadgeTipo tipo={campo.tipo} />
      </td>

      {/* Visible en */}
      <td className="px-3 py-3">
        <BadgesEtapas stageIds={campo.visibleEn} stages={stages} color="text-stone-600 dark:text-stone-400" />
      </td>

      {/* Requerido en */}
      <td className="px-3 py-3">
        <BadgesEtapas stageIds={campo.requeridoEn} stages={stages} color="text-amber-600 dark:text-amber-400" />
      </td>

      {/* Bloqueado en */}
      <td className="px-3 py-3">
        <BadgesEtapas stageIds={campo.bloqueadoEn} stages={stages} color="text-orange-600 dark:text-orange-400" />
      </td>

      {/* Estado + acciones */}
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-2">
          <Switch
            checked={activo}
            onCheckedChange={onToggleEstado}
            className="data-[state=checked]:bg-lime-500"
          />
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEditar}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onEliminar}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/8 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Panel principal ───────────────────────────────────────────────

interface PanelConfigCamposProps {
  pipeline: PipelineConStages;
}

export function PanelConfigCampos({ pipeline }: PanelConfigCamposProps) {
  const [campos, setCampos] = useState<CampoPersonalizadoPipeline[]>(pipeline.campos ?? []);
  const [campoEditando, setCampoEditando] = useState<CampoPersonalizadoPipeline | null | "nuevo">(null);
  const [, startTransition] = useTransition();

  const panelAbierto = campoEditando !== null;

  const handleCampoGuardado = (campo: CampoPersonalizadoPipeline) => {
    setCampos((prev) => {
      const idx = prev.findIndex((c) => c.id === campo.id);
      return idx >= 0 ? prev.map((c) => (c.id === campo.id ? campo : c)) : [...prev, campo];
    });
    setCampoEditando(campo);
  };

  const handleEliminar = (id: string) => {
    setCampos((prev) => prev.filter((c) => c.id !== id));
    if (typeof campoEditando === "object" && campoEditando?.id === id) setCampoEditando(null);
    startTransition(async () => {
      const r = await eliminarCampo(id);
      if (!r.exito) toast.error(r.error);
      else toast.success("Campo eliminado");
    });
  };

  const handleToggleEstado = (campo: CampoPersonalizadoPipeline) => {
    const nuevoActivo = !campo.activo;
    setCampos((prev) => prev.map((c) => (c.id === campo.id ? { ...c, activo: nuevoActivo } : c)));
    startTransition(async () => {
      const r = await toggleEstadoCampo(campo.id, nuevoActivo);
      if (!r.exito) {
        toast.error(r.error);
        setCampos((prev) => prev.map((c) => (c.id === campo.id ? { ...c, activo: campo.activo } : c)));
      }
    });
  };

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* Tabla principal */}
      <div className={cn("flex flex-col flex-1 min-w-0 transition-all", panelAbierto && "mr-0")}>
        {/* Header de la tabla */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-100">
              Campos personalizados del {pipeline.nombre}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Crea y configura campos dinámicos que estarán disponibles en todas las etapas del pipeline.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setCampoEditando("nuevo")}
            className="rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950 shadow-sm flex-shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo campo
          </Button>
        </div>

        {campos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-stone-200 dark:border-white/10 rounded-xl">
            <div className="h-10 w-10 rounded-xl bg-stone-100 dark:bg-white/5 flex items-center justify-center mb-3">
              <Power className="h-5 w-5 text-stone-400 dark:text-stone-600" />
            </div>
            <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Sin campos personalizados</p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 mb-4">
              Los campos pertenecen al pipeline y se pueden configurar por etapa
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCampoEditando("nuevo")}
              className="rounded-xl border-stone-200 dark:border-white/10"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Agregar primer campo
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 dark:border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 dark:bg-white/4 border-b border-stone-200 dark:border-white/10">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Campo</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Visible en</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Requerido en</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Bloqueado en</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody>
                {campos.map((campo) => (
                  <FilaCampo
                    key={campo.id}
                    campo={campo}
                    stages={pipeline.stages}
                    activo={campo.activo}
                    onEditar={() => setCampoEditando(campo)}
                    onEliminar={() => handleEliminar(campo.id)}
                    onToggleEstado={() => handleToggleEstado(campo)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-stone-400 dark:text-stone-600 mt-3">
          Los campos se mostrarán, requerirán o bloquearán según las reglas definidas para cada etapa.
        </p>
      </div>

      {/* Panel lateral de edición */}
      {panelAbierto && (
        <div className="w-80 flex-shrink-0 border-l border-stone-200 dark:border-white/10 ml-4 -mr-4 flex flex-col overflow-hidden">
          <PanelEditarCampo
            campo={campoEditando === "nuevo" ? null : campoEditando}
            stages={pipeline.stages}
            pipelineId={pipeline.id}
            onGuardado={handleCampoGuardado}
            onCerrar={() => setCampoEditando(null)}
          />
        </div>
      )}
    </div>
  );
}
