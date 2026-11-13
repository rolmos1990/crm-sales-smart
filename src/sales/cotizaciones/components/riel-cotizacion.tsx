"use client";

import { ChevronLeft, FileText } from "lucide-react";

// Riel vertical que queda cuando la cotización está plegada: recuerda que hay
// un borrador vivo y lo devuelve de un click. El punto verde es la señal de
// "hay algo sin terminar acá".

export function RielCotizacion({ onExpandir }: { onExpandir: () => void }) {
  return (
    <div className="flex w-11 shrink-0 flex-col items-center gap-3 border-l border-border bg-muted/30 py-3">
      <button
        type="button"
        onClick={onExpandir}
        title="Retomar la cotización en edición"
        aria-label="Retomar la cotización en edición"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary-border bg-primary-muted text-primary transition-colors hover:bg-primary-muted/70"
      >
        <FileText className="h-4 w-4" />
      </button>

      <span className="h-1.5 w-1.5 rounded-full bg-success-text" aria-hidden />

      <button
        type="button"
        onClick={onExpandir}
        className="flex flex-1 cursor-pointer items-center text-[11px] font-medium tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        // El texto se lee de arriba hacia abajo, como en el mockup.
        style={{ writingMode: "vertical-rl" }}
      >
        Cotización en edición
      </button>

      <button
        type="button"
        onClick={onExpandir}
        aria-label="Retomar la cotización en edición"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary-border hover:text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
