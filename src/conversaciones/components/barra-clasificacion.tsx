"use client";

import { useState } from "react";
import { Info, ShoppingBag, Headphones, TrendingUp, X, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClasificacionConversacion, ConversacionResumen } from "../types";

interface BarraClasificacionProps {
  conversacion: ConversacionResumen;
  onClasificar: (c: ClasificacionConversacion) => Promise<void>;
  onCrearOportunidad: () => Promise<void>;
}

const OPCIONES: {
  valor: ClasificacionConversacion;
  label: string;
  icono: React.ReactNode;
  descripcion: string;
  color: string;
  colorActivo: string;
}[] = [
  {
    valor: "POSTVENTA",
    label: "Postventa",
    icono: <ShoppingBag className="h-3 w-3" />,
    descripcion: "Consultas relacionadas con compras ya realizadas, envíos, facturas, garantías, devoluciones, etc.",
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
    colorActivo: "text-amber-300 border-amber-400/50 bg-amber-500/20 ring-1 ring-amber-400/30",
  },
  {
    valor: "SOPORTE",
    label: "Soporte",
    icono: <Headphones className="h-3 w-3" />,
    descripcion: "Problemas técnicos o dudas que requieren asistencia.",
    color: "text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20",
    colorActivo: "text-blue-300 border-blue-400/50 bg-blue-500/20 ring-1 ring-blue-400/30",
  },
  {
    valor: "COMERCIAL",
    label: "Comercial",
    icono: <TrendingUp className="h-3 w-3" />,
    descripcion: "Nuevas consultas o interés en comprar.",
    color: "text-lime-400 border-lime-500/30 bg-lime-500/10 hover:bg-lime-500/20",
    colorActivo: "text-lime-300 border-lime-400/50 bg-lime-500/20 ring-1 ring-lime-400/30",
  },
];

export function BarraClasificacion({
  conversacion,
  onClasificar,
  onCrearOportunidad,
}: BarraClasificacionProps) {
  const [accionando, setAccionando] = useState(false);
  const [creando, setCreando] = useState(false);

  const clasificacionActual = conversacion.clasificacion;
  const tieneOportunidadActiva = conversacion.oportunidades.some((o) => o.esActiva);
  const opcionActiva = OPCIONES.find((o) => o.valor === clasificacionActual);

  const handleClasificar = async (valor: ClasificacionConversacion) => {
    if (accionando) return;
    setAccionando(true);
    try {
      await onClasificar(valor === clasificacionActual ? "NINGUNA" : valor);
    } finally {
      setAccionando(false);
    }
  };

  const handleCrear = async () => {
    if (creando) return;
    setCreando(true);
    try {
      await onCrearOportunidad();
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-white/8 bg-white/3 shrink-0 space-y-2.5">
      {/* Mensaje informativo */}
      <div className="flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-stone-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-stone-400 leading-snug">
          Esta conversación está relacionada a una oportunidad ganada.
          Puedes clasificarla para gestionar mejor el seguimiento.
        </p>
      </div>

      {/* Selector de tipo */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-stone-600 uppercase tracking-wide font-semibold shrink-0">
          Tipo:
        </span>

        {OPCIONES.map((op) => {
          const activo = clasificacionActual === op.valor;
          return (
            <button
              key={op.valor}
              type="button"
              disabled={accionando}
              onClick={() => handleClasificar(op.valor)}
              title={op.descripcion}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all disabled:opacity-60",
                activo ? op.colorActivo : op.color
              )}
            >
              {op.icono}
              {op.label}
            </button>
          );
        })}

        {clasificacionActual !== "NINGUNA" && (
          <button
            type="button"
            disabled={accionando}
            onClick={() => handleClasificar("NINGUNA")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border text-stone-500 border-stone-700/50 bg-stone-800/30 hover:bg-stone-700/40 transition-all disabled:opacity-60"
          >
            <X className="h-3 w-3" />
            Quitar etiqueta
          </button>
        )}

        {accionando && <Loader2 className="h-3 w-3 text-stone-500 animate-spin shrink-0" />}
      </div>

      {/* Descripción de la clasificación activa */}
      {opcionActiva && (
        <p className="text-[10px] text-stone-500 leading-snug pl-1">
          {opcionActiva.descripcion}
        </p>
      )}

      {/* Acción comercial: crear oportunidad */}
      {clasificacionActual === "COMERCIAL" && !tieneOportunidadActiva && (
        <button
          type="button"
          disabled={creando}
          onClick={handleCrear}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-950 bg-lime-400 hover:bg-lime-300 rounded-lg px-3 py-1.5 transition-all hover:scale-[1.02] disabled:opacity-50 shadow-sm"
        >
          {creando
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Plus className="h-3 w-3" />}
          Crear oportunidad
        </button>
      )}
    </div>
  );
}
