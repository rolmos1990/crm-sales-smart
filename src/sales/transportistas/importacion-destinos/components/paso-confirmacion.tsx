"use client";

import { CheckCircle2, Loader2 } from "lucide-react";

interface PasoConfirmacionProps {
  cargando: boolean;
  resultado: { creados: number; actualizados: number } | null;
}

export function PasoConfirmacion({ cargando, resultado }: PasoConfirmacionProps) {
  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Importando destinos...</p>
      </div>
    );
  }

  if (!resultado) return null;

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <CheckCircle2 className="h-8 w-8 text-success" />
      <p className="text-sm font-medium text-foreground">Importación completada</p>
      <p className="text-sm text-muted-foreground">
        {resultado.creados} destinos nuevos · {resultado.actualizados} tarifas actualizadas en destinos existentes
      </p>
    </div>
  );
}
