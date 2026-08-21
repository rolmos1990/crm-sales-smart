"use client";

import { Info } from "lucide-react";

// Banner informativo mostrado sobre el chat cuando la conversación está
// relacionada con una oportunidad previa ya finalizada (ganada o perdida).
// La clasificación en sí (Postventa / Soporte / Comercial) se elige desde
// el panel de contacto, a la derecha — ver <PanelContactoInbox>.
export function BarraClasificacion() {
  return (
    <div className="px-4 py-2.5 border-b border-border bg-muted shrink-0 flex items-start gap-2">
      <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-[11px] text-muted-foreground leading-snug">
        Esta conversación está relacionada con una oportunidad ya finalizada. Clasifícala para gestionar mejor el seguimiento.
      </p>
    </div>
  );
}
