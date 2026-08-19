"use client";

import { Info } from "lucide-react";

// Banner informativo mostrado sobre el chat cuando la conversación está
// relacionada con una oportunidad ganada previa. La clasificación en sí
// (Postventa / Soporte / Comercial) se elige desde el panel de contacto,
// a la derecha — ver <PanelContactoInbox>.
export function BarraClasificacion() {
  return (
    <div className="px-4 py-2.5 border-b border-stone-200 dark:border-white/8 bg-stone-50 dark:bg-white/3 shrink-0 flex items-start gap-2">
      <Info className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500 shrink-0 mt-0.5" />
      <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-snug">
        Esta conversación está relacionada con una oportunidad ganada. Clasifícala para gestionar mejor el seguimiento.
      </p>
    </div>
  );
}
