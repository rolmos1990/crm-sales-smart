"use client";

// 011-playbook-estrategia-comercial (Historia 2) — asignar estrategias
// activas a un agente y ver el registro de selección (auditoría, SC-003).

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, X, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  obtenerAsignacionesDeAgente,
  obtenerEstrategiasActivas,
  obtenerSeleccionesRecientes,
  asignarEstrategiaAAgente,
  quitarAsignacionEstrategia,
} from "@/ai/estrategia/actions";

const SIN_SELECCION = "__NINGUNA__";

interface AsignarEstrategiasAgenteProps {
  agenteIAConfigId: string;
}

export function AsignarEstrategiasAgente({ agenteIAConfigId }: AsignarEstrategiasAgenteProps) {
  const [asignaciones, setAsignaciones] = useState<Awaited<ReturnType<typeof obtenerAsignacionesDeAgente>> | null>(null);
  const [estrategiasActivas, setEstrategiasActivas] = useState<Awaited<ReturnType<typeof obtenerEstrategiasActivas>>>([]);
  const [selecciones, setSelecciones] = useState<Awaited<ReturnType<typeof obtenerSeleccionesRecientes>>>([]);
  const [seleccionParaAsignar, setSeleccionParaAsignar] = useState(SIN_SELECCION);
  const [isPending, startTransition] = useTransition();

  async function recargar() {
    const [a, e, s] = await Promise.all([
      obtenerAsignacionesDeAgente(agenteIAConfigId),
      obtenerEstrategiasActivas(),
      obtenerSeleccionesRecientes(agenteIAConfigId),
    ]);
    setAsignaciones(a);
    setEstrategiasActivas(e);
    setSelecciones(s);
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenteIAConfigId]);

  function handleAsignar() {
    if (seleccionParaAsignar === SIN_SELECCION) return;
    startTransition(async () => {
      const resultado = await asignarEstrategiaAAgente({ agenteIAConfigId, playbookEstrategiaId: seleccionParaAsignar });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      setSeleccionParaAsignar(SIN_SELECCION);
      recargar();
    });
  }

  function handleQuitar(asignacionId: string) {
    startTransition(async () => {
      const resultado = await quitarAsignacionEstrategia(asignacionId);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      recargar();
    });
  }

  if (asignaciones === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  const yaAsignadasIds = new Set(asignaciones.map((a) => a.playbookEstrategiaId));
  const disponiblesParaAsignar = estrategiasActivas.filter((e) => !yaAsignadasIds.has(e.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-stone-300 text-xs uppercase tracking-wide font-medium">Estrategias asignadas</p>
        {asignaciones.length === 0 ? (
          <p className="text-stone-500 text-sm">Este agente no tiene estrategias asignadas todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {asignaciones.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2"
              >
                <span className="text-stone-200 text-sm">{a.playbookEstrategia.nombre}</span>
                <button
                  type="button"
                  onClick={() => handleQuitar(a.id)}
                  className="text-stone-500 hover:text-red-400"
                  disabled={isPending}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {disponiblesParaAsignar.length > 0 && (
          <div className="flex gap-2">
            <Select
              items={Object.fromEntries(disponiblesParaAsignar.map((e) => [e.id, e.nombre]))}
              value={seleccionParaAsignar}
              onValueChange={(valor) => setSeleccionParaAsignar(valor ?? SIN_SELECCION)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Elegí una estrategia activa..." />
              </SelectTrigger>
              <SelectContent>
                {disponiblesParaAsignar.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={handleAsignar}
              disabled={isPending || seleccionParaAsignar === SIN_SELECCION}
              className="bg-lime-500/90 text-stone-950 hover:bg-lime-400 font-semibold flex-shrink-0"
            >
              Asignar
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-stone-400" />
          <p className="text-stone-300 text-xs uppercase tracking-wide font-medium">
            Últimas selecciones (auditoría)
          </p>
        </div>
        {selecciones.length === 0 ? (
          <p className="text-stone-500 text-sm">Todavía no hay selecciones registradas para este agente.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
            {selecciones.map((s) => (
              <li key={s.id} className="text-xs text-stone-400 border-l-2 border-white/10 pl-2.5 py-1">
                <span className="text-stone-500">{new Date(s.creadoEn).toLocaleString()}</span> — {s.motivo}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
