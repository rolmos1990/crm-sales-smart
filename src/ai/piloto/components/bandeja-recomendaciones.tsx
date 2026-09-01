"use client";

// 014-conversaciones-piloto-ejemplos-relevantes (Historia 2) — bandeja de
// recomendaciones producidas por el análisis de conversaciones piloto.
// Ninguna acción de esta bandeja escribe directamente en AgenteIAConfig
// (FR-008) — aprobar/rechazar solo cambian estado; "convertir en regla" es
// una redirección al flujo de 009 (research.md Decisión 4).

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, FileText, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  obtenerRecomendacionesAction,
  ejecutarAnalisisPilotoAction,
  aprobarRecomendacion,
  rechazarRecomendacion,
  convertirRecomendacionEnRegla,
  convertirRecomendacionEnEjemplo,
} from "@/ai/piloto/actions";

type Recomendacion = Awaited<ReturnType<typeof obtenerRecomendacionesAction>>[number];

const ESTADO_LABEL: Record<Recomendacion["estado"], string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  CONVERTIDA_REGLA: "Convertida en regla",
  CONVERTIDA_EJEMPLO: "Convertida en ejemplo",
};

interface BandejaRecomendacionesProps {
  agenteIAConfigId?: string;
}

export function BandejaRecomendaciones({ agenteIAConfigId }: BandejaRecomendacionesProps) {
  const [recomendaciones, setRecomendaciones] = useState<Recomendacion[] | null>(null);
  const [isPending, startTransition] = useTransition();

  async function recargar() {
    setRecomendaciones(await obtenerRecomendacionesAction(agenteIAConfigId));
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenteIAConfigId]);

  function handleAnalizar() {
    startTransition(async () => {
      const resultado = await ejecutarAnalisisPilotoAction(agenteIAConfigId);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      if (resultado.recomendacionesGeneradas === 0) {
        toast.info("El análisis no encontró patrones nuevos accionables");
      } else {
        toast.success(`${resultado.recomendacionesGeneradas} recomendación(es) nueva(s)`);
      }
      recargar();
    });
  }

  function accion(fn: (id: string) => Promise<{ exito: boolean; error?: string }>, id: string, mensajeExito: string) {
    startTransition(async () => {
      const resultado = await fn(id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success(mensajeExito);
      recargar();
    });
  }

  const pendientes = recomendaciones?.filter((r) => r.estado === "PENDIENTE") ?? [];
  const resueltas = recomendaciones?.filter((r) => r.estado !== "PENDIENTE") ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-stone-300 text-xs uppercase tracking-wide font-medium">Recomendaciones de comportamiento</p>
        <Button type="button" size="sm" onClick={handleAnalizar} disabled={isPending} className="bg-lime-500/90 text-stone-950 hover:bg-lime-400 font-semibold">
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Ejecutar análisis
        </Button>
      </div>

      {recomendaciones === null ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      ) : pendientes.length === 0 ? (
        <p className="text-stone-500 text-sm">Sin recomendaciones pendientes. Ejecutá un análisis para generar nuevas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pendientes.map((r) => (
            <li key={r.id} className="rounded-xl border border-white/8 bg-white/3 p-3 flex flex-col gap-2">
              <div>
                <p className="text-stone-200 text-sm font-medium">{r.titulo}</p>
                <p className="text-stone-400 text-xs mt-0.5">{r.descripcion}</p>
                <p className="text-stone-500 text-xs mt-1 italic">&ldquo;{r.reglaSugerida}&rdquo;</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button type="button" size="sm" onClick={() => accion(aprobarRecomendacion, r.id, "Recomendación aprobada")} disabled={isPending}>
                  <Check className="h-3.5 w-3.5" />Aprobar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => accion(rechazarRecomendacion, r.id, "Recomendación rechazada")} disabled={isPending}>
                  <X className="h-3.5 w-3.5" />Rechazar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    startTransition(async () => {
                      const resultado = await convertirRecomendacionEnRegla(r.id);
                      if (!resultado.exito) {
                        toast.error(resultado.error);
                        return;
                      }
                      navigator.clipboard?.writeText(resultado.reglaSugerida).catch(() => {});
                      toast.success("Regla copiada — pegala en Configuración → Agente → Reglas", { duration: 6000 });
                      recargar();
                    })
                  }
                  disabled={isPending}
                >
                  <FileText className="h-3.5 w-3.5" />Convertir en regla
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => accion(convertirRecomendacionEnEjemplo, r.id, "Ejemplo creado")} disabled={isPending}>
                  <BookOpen className="h-3.5 w-3.5" />Convertir en ejemplo
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {resueltas.length > 0 && (
        <details className="text-xs">
          <summary className="text-stone-500 cursor-pointer">Resueltas ({resueltas.length})</summary>
          <ul className="flex flex-col gap-1.5 mt-2">
            {resueltas.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-stone-500 border-l-2 border-white/10 pl-2 py-1">
                <span>{r.titulo}</span>
                <Badge variant="outline">{ESTADO_LABEL[r.estado]}</Badge>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
