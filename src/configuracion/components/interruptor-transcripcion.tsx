"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { guardarTranscripcionVozHabilitada } from "@/configuracion/voz/actions";

/**
 * 049 — El interruptor de la feature. Apagado por defecto: encenderlo implica
 * mandar el audio de las conversaciones a un tercero y gastar saldo, así que
 * es una decisión explícita del comercio.
 */
export function InterruptorTranscripcion({
  habilitada,
  hayProveedorUtilizable,
}: {
  habilitada: boolean;
  hayProveedorUtilizable: boolean;
}) {
  const [valor, setValor] = useState(habilitada);
  const [guardando, iniciar] = useTransition();

  function alCambiar(nuevo: boolean) {
    // Optimista: se revierte si el servidor rechaza.
    setValor(nuevo);
    iniciar(async () => {
      const r = await guardarTranscripcionVozHabilitada(nuevo);
      if (!r.exito) {
        setValor(!nuevo);
        toast.error(r.error);
        return;
      }
      toast.success(nuevo ? "Transcripción activada" : "Transcripción desactivada");
    });
  }

  // Sin proveedor utilizable el interruptor diría que está activa y ningún
  // audio se transcribiría: se bloquea en vez de mentir.
  const bloqueado = !hayProveedorUtilizable && !valor;

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Transcripción automática</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Cada nota de voz que llegue —entrante o enviada desde la app del canal— se convierte
          en texto automáticamente.
        </p>
        {bloqueado && (
          <p className="mt-2 text-xs text-stage-amber-text">
            Primero cargá un proveedor de voz activo con su API key.
          </p>
        )}
        {valor && (
          <p className="mt-2 text-xs text-muted-foreground">
            Las notas de voz anteriores a la activación no se transcriben solas.
          </p>
        )}
      </div>
      <Switch
        checked={valor}
        onCheckedChange={alCambiar}
        disabled={guardando || bloqueado}
        aria-label="Transcripción automática de notas de voz"
      />
    </div>
  );
}
