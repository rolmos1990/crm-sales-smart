"use client";

import { useState, useTransition } from "react";
import { Phone, Pencil, Trash2, Power, Check, X, GitBranch, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { actualizarNombreCuenta, activarCuenta, desactivarCuenta, eliminarCuenta, configurarPipelineCuenta, configurarStageCuenta } from "../actions";

interface TarjetaNumeroProps {
  cuenta: {
    id: string;
    nombre: string;
    identificador: string;
    activa: boolean;
    pipelineId: string | null;
    stageId: string | null;
  };
  pipelines: {
    id: string;
    nombre: string;
    esDefault: boolean;
    stages: { id: string; nombre: string; esInicial: boolean }[];
  }[];
}

export function TarjetaNumero({ cuenta, pipelines }: TarjetaNumeroProps) {
  const [editando, setEditando] = useState(false);
  const [nombreEdit, setNombreEdit] = useState(cuenta.nombre);
  const [selectedPipelineId, setSelectedPipelineId] = useState(cuenta.pipelineId ?? "");
  const [selectedStageId, setSelectedStageId] = useState(cuenta.stageId ?? "");
  const [isPending, startTransition] = useTransition();

  const stagesDelPipeline = pipelines.find((p) => p.id === selectedPipelineId)?.stages ?? [];

  const guardarNombre = () => {
    if (!nombreEdit.trim() || nombreEdit === cuenta.nombre) { setEditando(false); return; }
    startTransition(async () => {
      await actualizarNombreCuenta(cuenta.id, nombreEdit.trim());
      setEditando(false);
    });
  };

  const toggleActivar = () => {
    startTransition(async () => {
      if (cuenta.activa) await desactivarCuenta(cuenta.id);
      else await activarCuenta(cuenta.id);
    });
  };

  const handlePipeline = (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
    setSelectedStageId("");
    startTransition(async () => {
      await configurarPipelineCuenta(cuenta.id, pipelineId || null);
    });
  };

  const handleStage = (stageId: string) => {
    setSelectedStageId(stageId);
    startTransition(async () => {
      await configurarStageCuenta(cuenta.id, stageId || null);
    });
  };

  const handleEliminar = () => {
    if (!confirm(`¿Eliminar "${cuenta.nombre}"? Se perderán las conversaciones asociadas.`)) return;
    startTransition(() => eliminarCuenta(cuenta.id));
  };

  return (
    <div className={cn(
      "rounded-2xl border transition-all bg-white/3 backdrop-blur-sm",
      cuenta.activa
        ? "border-green-500/20 hover:border-green-500/30"
        : "border-white/8 opacity-70"
    )}>
      {/* Fila principal */}
      <div className="flex items-center gap-3 p-4">
        {/* Ícono */}
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          cuenta.activa ? "bg-green-500/15" : "bg-white/5"
        )}>
          <Phone className={cn("h-4.5 w-4.5", cuenta.activa ? "text-green-400" : "text-stone-500")} />
        </div>

        {/* Nombre y número */}
        <div className="flex-1 min-w-0">
          {editando ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nombreEdit}
                onChange={(e) => setNombreEdit(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") guardarNombre(); if (e.key === "Escape") setEditando(false); }}
                className="flex-1 text-sm bg-white/5 border border-white/15 rounded-lg px-2 py-1 text-stone-100 outline-none focus:border-lime-500/40"
                autoFocus
              />
              <button type="button" onClick={guardarNombre} className="text-lime-400 hover:text-lime-300">
                <Check className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setEditando(false)} className="text-stone-500 hover:text-stone-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-stone-100 truncate">{cuenta.nombre}</p>
              <p className="text-xs text-stone-500 mt-0.5">{cuenta.identificador}</p>
            </>
          )}
        </div>

        {/* Badge estado */}
        <span className={cn(
          "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0",
          cuenta.activa
            ? "bg-green-500/15 text-green-400 border border-green-500/20"
            : "bg-white/5 text-stone-500 border border-white/10"
        )}>
          {cuenta.activa ? "Activa" : "Inactiva"}
        </span>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setEditando(true)}
            disabled={isPending || editando}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-white/5 transition-colors"
            title="Renombrar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleActivar}
            disabled={isPending}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              cuenta.activa
                ? "text-stone-500 hover:text-amber-400 hover:bg-amber-500/10"
                : "text-stone-500 hover:text-green-400 hover:bg-green-500/10"
            )}
            title={cuenta.activa ? "Desactivar" : "Activar"}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleEliminar}
            disabled={isPending}
            className="p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Selectores de pipeline y etapa */}
      {pipelines.length > 0 && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-white/5 pt-3">
          {/* Pipeline */}
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-stone-500 shrink-0" />
            <span className="text-[11px] text-stone-500 shrink-0 w-28">Pipeline de entrada:</span>
            <select
              value={selectedPipelineId}
              onChange={(e) => handlePipeline(e.target.value)}
              disabled={isPending}
              className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-stone-200 outline-none focus:border-lime-500/30 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <option value="">— Automático (default) —</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.esDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Etapa — solo cuando hay pipeline seleccionado */}
          {selectedPipelineId && (
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-stone-500 shrink-0" />
              <span className="text-[11px] text-stone-500 shrink-0 w-28">Etapa de entrada:</span>
              <select
                value={selectedStageId}
                onChange={(e) => handleStage(e.target.value)}
                disabled={isPending}
                className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-stone-200 outline-none focus:border-lime-500/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <option value="">— Etapa inicial del pipeline —</option>
                {stagesDelPipeline.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}{s.esInicial ? " (inicial)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
