"use client";

import { useState, useTransition } from "react";
import { Phone, Pencil, Trash2, Power, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { actualizarNombreCuenta, activarCuenta, desactivarCuenta, eliminarCuenta } from "../actions";

interface TarjetaNumeroProps {
  cuenta: {
    id: string;
    nombre: string;
    identificador: string;
    activa: boolean;
  };
}

export function TarjetaNumero({ cuenta }: TarjetaNumeroProps) {
  const [editando, setEditando] = useState(false);
  const [nombreEdit, setNombreEdit] = useState(cuenta.nombre);
  const [isPending, startTransition] = useTransition();

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

  const handleEliminar = () => {
    if (!confirm(`¿Eliminar "${cuenta.nombre}"? Se perderán las conversaciones asociadas.`)) return;
    startTransition(() => eliminarCuenta(cuenta.id));
  };

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-2xl border p-4 transition-all",
      "bg-white/3 backdrop-blur-sm",
      cuenta.activa
        ? "border-green-500/20 hover:border-green-500/30"
        : "border-white/8 opacity-70"
    )}>
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
  );
}
