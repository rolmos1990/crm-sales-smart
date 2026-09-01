"use client";

// 018-simulador-agente (Historia 3) — comparar la versión publicada vs. el
// borrador para el mismo mensaje, lado a lado (research.md Decisión 4).

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ejecutarSimulacionAction } from "@/ai/simulador/actions";
import { DiagnosticoCard } from "./panel-simulador";
import type { DiagnosticoRespuestaSimulada, TipoRelacionCliente, IntencionComercial } from "@/ai/simulador/tipos";

interface ComparadorVersionesProps {
  agenteIAConfigId: string;
}

const CLIENTE_DEFAULT = { tipoRelacion: "CLIENTE_NUEVO" as TipoRelacionCliente, intencion: "EXPLORANDO" as IntencionComercial };

export function ComparadorVersiones({ agenteIAConfigId }: ComparadorVersionesProps) {
  const [mensaje, setMensaje] = useState("");
  const [publicada, setPublicada] = useState<DiagnosticoRespuestaSimulada | null>(null);
  const [borrador, setBorrador] = useState<DiagnosticoRespuestaSimulada | null>(null);
  const [isPending, startTransition] = useTransition();

  function comparar() {
    if (!mensaje.trim()) return;
    startTransition(async () => {
      const [resultadoPublicada, resultadoBorrador] = await Promise.all([
        ejecutarSimulacionAction({ agenteIAConfigId, cliente: CLIENTE_DEFAULT, usarBorrador: false, mensajes: [mensaje.trim()] }),
        ejecutarSimulacionAction({ agenteIAConfigId, cliente: CLIENTE_DEFAULT, usarBorrador: true, mensajes: [mensaje.trim()] }),
      ]);

      if (!resultadoPublicada.exito) {
        toast.error(resultadoPublicada.error);
        return;
      }
      if (!resultadoBorrador.exito) {
        toast.error(resultadoBorrador.error);
        return;
      }
      setPublicada(resultadoPublicada.diagnosticos[0] ?? null);
      setBorrador(resultadoBorrador.diagnosticos[0] ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-stone-500 text-xs">
        Ejecuta el mismo mensaje contra la versión publicada vigente y contra el borrador actual, sin publicar nada.
      </p>

      <Textarea
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        placeholder="Mensaje de prueba para comparar..."
        rows={2}
        className="bg-white/5 border-white/10 text-stone-50"
      />

      <Button
        type="button"
        onClick={comparar}
        disabled={isPending || !mensaje.trim()}
        className="self-end bg-lime-500/90 text-stone-950 hover:bg-lime-400 font-semibold"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
        Comparar
      </Button>

      {(publicada || borrador) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-stone-300 text-xs uppercase tracking-wide font-medium">Publicada vigente</p>
            {publicada ? <DiagnosticoCard diagnostico={publicada} /> : <p className="text-stone-500 text-sm">Sin resultado.</p>}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-stone-300 text-xs uppercase tracking-wide font-medium">Borrador</p>
            <p className="text-stone-600 text-[11px] -mt-1">Si no hay borrador guardado, se muestra la publicada vigente.</p>
            {borrador ? <DiagnosticoCard diagnostico={borrador} /> : <p className="text-stone-500 text-sm">Sin resultado.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
