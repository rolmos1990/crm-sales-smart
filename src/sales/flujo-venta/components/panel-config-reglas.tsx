"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Power, PowerOff, Loader2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { crearRegla, actualizarRegla, eliminarRegla, toggleRegla } from "../actions";
import type { FlujoVentaEtapa, FlujoVentaRegla, FlujoVentaReglaCondicion } from "../types";
import { CAMPOS_EVALUABLES, OPERADORES_CONFIG } from "../types";
import type { OperadorCondicion } from "../types";

type CondicionDraft = Omit<FlujoVentaReglaCondicion, "id" | "reglaId">;

function FormCondicion({
  condicion,
  onChange,
  onEliminar,
}: {
  condicion: CondicionDraft;
  onChange: (c: CondicionDraft) => void;
  onEliminar: () => void;
}) {
  const operadorConf = OPERADORES_CONFIG[condicion.operador as OperadorCondicion];
  const esBooleano = operadorConf?.tipo === "booleano";

  return (
    <div className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/3 px-3 py-2">
      <Select value={condicion.campo} onValueChange={(v) => v && onChange({ ...condicion, campo: v })}>
        <SelectTrigger className="h-7 text-xs bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-lg min-w-[160px]">
          <SelectValue placeholder="Campo..." />
        </SelectTrigger>
        <SelectContent>
          {CAMPOS_EVALUABLES.map((c) => (
            <SelectItem key={c.valor} value={c.valor} className="text-xs">{c.etiqueta}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={condicion.operador} onValueChange={(v) => v && onChange({ ...condicion, operador: v as OperadorCondicion })}>
        <SelectTrigger className="h-7 text-xs bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-lg min-w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(OPERADORES_CONFIG).map(([key, conf]) => (
            <SelectItem key={key} value={key} className="text-xs">{conf.etiqueta}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!esBooleano && (
        <Input
          className="h-7 text-xs bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-lg flex-1 min-w-[100px]"
          placeholder="Valor..."
          value={condicion.valor}
          onChange={(e) => onChange({ ...condicion, valor: e.target.value })}
        />
      )}

      <button
        onClick={onEliminar}
        className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-500/8 transition-colors flex-shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DialogRegla({
  regla, etapas, open, onOpenChange, onGuardado,
}: {
  regla: FlujoVentaRegla | null;
  etapas: FlujoVentaEtapa[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGuardado: (r: FlujoVentaRegla) => void;
}) {
  const [nombre, setNombre] = useState(regla?.nombre ?? "");
  const [etapaDestinoId, setEtapaDestinoId] = useState(regla?.etapaDestinoId ?? "");
  const [prioridad, setPrioridad] = useState(regla?.prioridad ?? 0);
  const [condiciones, setCondiciones] = useState<CondicionDraft[]>(
    regla?.condiciones?.map(({ campo, operador, valor }) => ({ campo, operador, valor })) ?? [
      { campo: "metadata.estadoPago", operador: "IGUAL", valor: "" },
    ]
  );
  const [isPending, startTransition] = useTransition();

  const agregarCondicion = () => {
    setCondiciones((prev) => [...prev, { campo: "metadata.estadoPago", operador: "IGUAL", valor: "" }]);
  };

  const handleGuardar = () => {
    if (!nombre.trim() || !etapaDestinoId || condiciones.length === 0) return;
    startTransition(async () => {
      const datos = { nombre: nombre.trim(), etapaDestinoId, prioridad, activo: regla?.activo ?? true, condiciones };
      const resultado = regla
        ? await actualizarRegla(regla.id, datos)
        : await crearRegla(datos);

      if (resultado.exito) {
        toast.success(regla ? "Regla actualizada" : "Regla creada");
        const etapaDestino = etapas.find((e) => e.id === etapaDestinoId)!;
        onGuardado({
          id: regla?.id ?? "temp",
          nombre: nombre.trim(), descripcion: null,
          activo: regla?.activo ?? true, prioridad, etapaDestinoId,
          condiciones: condiciones.map((c, i) => ({ ...c, id: `c-${i}`, reglaId: regla?.id ?? "" })),
          etapaDestino,
        } as FlujoVentaRegla);
        onOpenChange(false);
      } else {
        toast.error(resultado.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="text-stone-900 dark:text-stone-50">
            {regla ? "Editar regla" : "Nueva regla"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5 block">Nombre de la regla</Label>
            <Input
              autoFocus value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Pago confirmado → Preparando"
              className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5 block">Requerido para llegar a</Label>
              <Select value={etapaDestinoId} onValueChange={(v) => v && setEtapaDestinoId(v)}>
                <SelectTrigger className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl">
                  {etapaDestinoId ? (() => {
                    const e = etapas.find((x) => x.id === etapaDestinoId);
                    return e ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color ?? "#4ade80" }} />
                        <span>{e.nombre}</span>
                      </div>
                    ) : <SelectValue placeholder="Seleccionar..." />;
                  })() : <SelectValue placeholder="Seleccionar..." />}
                </SelectTrigger>
                <SelectContent>
                  {etapas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.color ?? "#4ade80" }} />
                        {e.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5 block">Prioridad (menor = primero)</Label>
              <Input
                type="number" min={0} max={999}
                value={prioridad}
                onChange={(e) => setPrioridad(Number(e.target.value))}
                className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                Condiciones (todas deben cumplirse)
              </Label>
              <button
                onClick={agregarCondicion}
                className="flex items-center gap-1 text-xs text-lime-600 dark:text-lime-400 hover:underline"
              >
                <Plus className="h-3 w-3" /> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {condiciones.map((c, i) => (
                <FormCondicion
                  key={i}
                  condicion={c}
                  onChange={(updated) => setCondiciones((prev) => prev.map((x, j) => j === i ? updated : x))}
                  onEliminar={() => setCondiciones((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button
            onClick={handleGuardar}
            disabled={!nombre.trim() || !etapaDestinoId || condiciones.length === 0 || isPending}
            className="rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {regla ? "Guardar" : "Crear regla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PanelConfigReglasProps {
  etapas: FlujoVentaEtapa[];
  reglasIniciales: FlujoVentaRegla[];
}

export function PanelConfigReglas({ etapas, reglasIniciales }: PanelConfigReglasProps) {
  const [reglas, setReglas] = useState<FlujoVentaRegla[]>(reglasIniciales);
  const [reglaEditando, setReglaEditando] = useState<FlujoVentaRegla | null>(null);
  const [dialogAbierto, setDialogAbierto] = useState(false);

  const etapasPorId = Object.fromEntries(etapas.map((e) => [e.id, e]));

  const handleToggle = (reglaId: string, activo: boolean) => {
    setReglas((prev) => prev.map((r) => r.id === reglaId ? { ...r, activo } : r));
    toggleRegla(reglaId, activo).then((r) => {
      if (!r.exito) {
        toast.error(r.error);
        setReglas((prev) => prev.map((r2) => r2.id === reglaId ? { ...r2, activo: !activo } : r2));
      }
    });
  };

  const handleEliminar = (id: string) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    setReglas((prev) => prev.filter((r) => r.id !== id));
    eliminarRegla(id).then((r) => {
      if (r.exito) toast.success("Regla eliminada");
      else { toast.error(r.error); }
    });
  };

  const handleGuardado = (reglaGuardada: FlujoVentaRegla) => {
    setReglas((prev) => {
      const idx = prev.findIndex((r) => r.id === reglaGuardada.id);
      if (idx >= 0) return prev.map((r) => r.id === reglaGuardada.id ? reglaGuardada : r);
      return [...prev, reglaGuardada];
    });
  };

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Si una etapa tiene reglas, <strong>todas deben cumplirse</strong> para permitir mover el pedido a ella.
        </p>
        <Button
          size="sm"
          onClick={() => { setReglaEditando(null); setDialogAbierto(true); }}
          className="rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950 flex-shrink-0"
        >
          <Plus className="h-4 w-4 mr-1" /> Nueva regla
        </Button>
      </div>

      {reglas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 dark:border-white/12 p-8 text-center">
          <p className="text-sm text-stone-400 dark:text-stone-500">Sin reglas configuradas.</p>
          <p className="text-xs text-stone-400/60 dark:text-stone-600 mt-1">
            Agrega reglas para requerir condiciones antes de llegar a una etapa.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...reglas].sort((a, b) => a.prioridad - b.prioridad).map((regla) => {
            const etapaDest = etapasPorId[regla.etapaDestinoId];
            return (
              <div
                key={regla.id}
                className={cn(
                  "rounded-xl border px-4 py-3 transition-all",
                  regla.activo
                    ? "bg-white dark:bg-white/5 border-stone-200 dark:border-white/10"
                    : "bg-stone-50/50 dark:bg-white/2 border-stone-200/60 dark:border-white/5 opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">{regla.nombre}</span>
                      {etapaDest && (
                        <span className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                          requerido para →{" "}
                          <span className="font-medium" style={{ color: etapaDest.color ?? undefined }}>{etapaDest.nombre}</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {regla.condiciones.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-stone-100 dark:bg-white/8 px-2 py-0.5 text-xs text-stone-600 dark:text-stone-300 font-mono">
                          {c.campo} {OPERADORES_CONFIG[c.operador]?.etiqueta ?? c.operador} {c.valor && `"${c.valor}"`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(regla.id, !regla.activo)}
                      className={cn(
                        "h-6 w-6 flex items-center justify-center rounded-lg transition-colors",
                        regla.activo
                          ? "text-emerald-500 hover:bg-emerald-500/8"
                          : "text-stone-400 hover:bg-stone-100 dark:hover:bg-white/8"
                      )}
                      title={regla.activo ? "Desactivar" : "Activar"}
                    >
                      {regla.activo ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => { setReglaEditando(regla); setDialogAbierto(true); }}
                      className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleEliminar(regla.id)}
                      className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-500/8 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DialogRegla
        key={reglaEditando?.id ?? "nueva"}
        regla={reglaEditando}
        etapas={etapas}
        open={dialogAbierto}
        onOpenChange={(v) => { setDialogAbierto(v); if (!v) setReglaEditando(null); }}
        onGuardado={handleGuardado}
      />
    </div>
  );
}
