"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle, Mail, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CuentaCanalResumen } from "../types";

// Mismo criterio de ícono/color por canal que el resto del Inbox (ver
// infoCanal en inbox-layout.tsx) — así el agente reconoce el canal igual en
// la lista de conversaciones y acá, en el selector sobre el input de envío.
const iconoCanal = (canal: string): React.ReactNode => {
  if (canal.startsWith("whatsapp")) return <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-green-400" />;
  if (canal === "instagram") return <Camera className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />;
  if (canal === "email") return <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
  return <MessageCircle className="h-3.5 w-3.5 text-stone-400 dark:text-stone-400" />;
};

interface SelectorCuentaCanalProps {
  cuentas: CuentaCanalResumen[];
  seleccionada: string | null;
  onSeleccionar: (id: string) => void;
}

export function SelectorCuentaCanal({ cuentas, seleccionada, onSeleccionar }: SelectorCuentaCanalProps) {
  const [abierto, setAbierto] = useState(false);
  const cuenta = cuentas.find((c) => c.id === seleccionada);

  if (cuentas.length === 0) {
    return <span className="text-xs text-stone-400 dark:text-stone-500 px-2">Sin cuentas configuradas</span>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 border border-stone-200 dark:border-white/10 rounded-lg px-2 py-1.5 transition-colors"
      >
        {cuenta ? (
          <>
            {iconoCanal(cuenta.canal)}
            <span className="max-w-[120px] truncate">{cuenta.nombre}</span>
          </>
        ) : (
          <span className="text-stone-400 dark:text-stone-400">Seleccionar canal</span>
        )}
        <ChevronDown className={cn("h-3 w-3 transition-transform", abierto && "rotate-180")} />
      </button>
      {abierto && (
        <div className="absolute bottom-full mb-1 left-0 z-50 min-w-[180px] bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 rounded-xl shadow-lg dark:shadow-xl overflow-hidden">
          {cuentas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onSeleccionar(c.id); setAbierto(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-stone-50 dark:hover:bg-white/5 transition-colors text-stone-700 dark:text-stone-200",
                seleccionada === c.id && "bg-lime-50 dark:bg-lime-500/10 text-lime-700 dark:text-lime-300"
              )}
            >
              {iconoCanal(c.canal)}
              <div>
                <p className="font-medium">{c.nombre}</p>
                <p className="text-stone-400 dark:text-stone-500 text-[10px]">{c.identificador}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
