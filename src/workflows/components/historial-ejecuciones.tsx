"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ChevronRight, CircleSlash, Clock, Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import { useSesion } from "@/shared/auth/sesion-context";
import { cn } from "@/lib/utils";
import type { EstadoEjecucionWorkflow } from "@/generated/prisma/enums";
import { CATALOGO_NODOS } from "../definicion/catalogo-nodos";
import { DefinicionWorkflowSchema, type TipoNodo } from "../definicion/schema";
import { cancelarEjecucionAction, obtenerEjecucionesOportunidadAction } from "../actions";
import type { EjecucionHistorial } from "../queries";

const ESTADO: Record<EstadoEjecucionWorkflow, { etiqueta: string; Icono: typeof Clock; clase: string; activa: boolean }> = {
  EJECUTANDO: { etiqueta: "En curso", Icono: PlayCircle, clase: "text-stage-lavender-text", activa: true },
  ESPERANDO_RESPUESTA: { etiqueta: "Esperando respuesta", Icono: Clock, clase: "text-stage-cyan-text", activa: true },
  ESPERANDO_TIMER: { etiqueta: "Esperando", Icono: Clock, clase: "text-stage-cyan-text", activa: true },
  ESPERANDO_ACCION_EXTERNA: { etiqueta: "Esperando revisión", Icono: Clock, clase: "text-stage-cyan-text", activa: true },
  IA_ACTIVA: { etiqueta: "IA atendiendo", Icono: PlayCircle, clase: "text-stage-purple-text", activa: true },
  TRANSFERIDA_HUMANO: { etiqueta: "En pausa (humano)", Icono: PauseCircle, clase: "text-warning", activa: true },
  COMPLETADA: { etiqueta: "Completada", Icono: CheckCircle2, clase: "text-success-text", activa: false },
  FALLIDA: { etiqueta: "Falló", Icono: AlertCircle, clase: "text-danger-text", activa: false },
  CANCELADA: { etiqueta: "Cancelada", Icono: CircleSlash, clase: "text-muted-foreground", activa: false },
};

function nombresNodos(definicion: unknown): Map<string, string> {
  const def = DefinicionWorkflowSchema.safeParse(definicion);
  return new Map(def.success ? def.data.nodos.map((n) => [n.id, n.etiqueta?.trim() || CATALOGO_NODOS[n.tipo].etiqueta]) : []);
}

/** Historial de Workflows de una oportunidad: qué corrió, por dónde pasó y cómo terminó (B6). */
export function HistorialEjecuciones({ oportunidadId }: { oportunidadId: string }) {
  const clave = ["workflow-ejecuciones", oportunidadId];
  const { data, isLoading } = useQuery({
    queryKey: clave,
    queryFn: () => obtenerEjecucionesOportunidadAction(oportunidadId),
    refetchInterval: (q) => (q.state.data?.some((e) => ESTADO[e.estado].activa) ? 20_000 : false),
  });

  if (isLoading) return <Skeleton className="h-16 w-full rounded-xl" />;
  if (!data || data.length === 0) {
    return <p className="text-xs text-muted-foreground">Ningún Workflow se ha ejecutado para esta oportunidad.</p>;
  }
  return (
    <ul className="space-y-2" data-slot="historial-ejecuciones">
      {data.map((ej) => (
        <FilaEjecucion key={ej.id} ejecucion={ej} clave={clave} />
      ))}
    </ul>
  );
}

function FilaEjecucion({ ejecucion: ej, clave }: { ejecucion: EjecucionHistorial; clave: string[] }) {
  const [abierta, setAbierta] = useState(false);
  const [cancelando, startCancelar] = useTransition();
  const queryClient = useQueryClient();
  const { puedeModificar } = useSesion();
  const estado = ESTADO[ej.estado];
  const nombres = nombresNodos(ej.version.definicion);
  const detalle = ej.error ?? ej.motivoCancelacion ?? (ej.resultado ? `Resultado: ${ej.resultado}` : null);

  return (
    <li className="rounded-xl border border-card-border bg-card">
      <button type="button" onClick={() => setAbierta((v) => !v)} className="flex w-full items-start gap-2 p-2.5 text-left">
        <estado.Icono className={cn("mt-0.5 h-4 w-4 shrink-0", estado.clase)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="truncate text-xs font-medium text-foreground">{ej.workflow.nombre}</span>
            <span className="text-[10px] text-muted-foreground">v{ej.version.numero}</span>
            <span className={cn("text-[11px]", estado.clase)}>{estado.etiqueta}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            <FechaHora valor={ej.iniciadaEn} modo="fechaHora" />
            {estado.activa && ej.nodoActualId && ` · en “${nombres.get(ej.nodoActualId) ?? ej.nodoActualId}”`}
            {ej.esperaHasta && estado.activa && (
              <>
                {" "}hasta <FechaHora valor={ej.esperaHasta} modo="fechaHora" />
              </>
            )}
          </p>
          {detalle && <p className={cn("text-[11px]", ej.estado === "FALLIDA" ? "text-danger-text" : "text-muted-foreground")}>{detalle}</p>}
        </div>
        <ChevronRight className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", abierta && "rotate-90")} />
      </button>

      {abierta && (
        <div className="border-t border-card-divider px-2.5 py-2">
          <ol className="space-y-1">
            {ej.pasos.map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-[11px]">
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    p.estado === "ERROR" ? "bg-danger" : p.estado === "ESPERANDO" ? "bg-stage-cyan" : "bg-muted-foreground",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground">{nombres.get(p.nodoId) ?? CATALOGO_NODOS[p.tipoNodo as TipoNodo]?.etiqueta ?? p.nodoId}</span>
                  {p.salida && p.salida !== "siguiente" && p.salida !== "fin" && <span className="text-muted-foreground"> → {p.salida}</span>}
                  {p.estado === "ESPERANDO" && <span className="text-muted-foreground"> (esperando)</span>}
                  {p.error && <span className="block text-danger-text">{p.error}</span>}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  <FechaHora valor={p.ocurridoEn} modo="hora" />
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex items-center gap-3">
            <Link href={`/crm/workflows/${ej.workflow.id}`} className="text-[11px] font-medium text-foreground underline-offset-4 hover:underline">
              Abrir Workflow
            </Link>
            {estado.activa && puedeModificar("workflows") && (
              <button
                type="button"
                disabled={cancelando}
                onClick={() =>
                  startCancelar(async () => {
                    const r = await cancelarEjecucionAction(ej.id);
                    if (!r.exito) return void toast.error(r.error);
                    toast.success("Ejecución cancelada");
                    await queryClient.invalidateQueries({ queryKey: clave });
                  })
                }
                className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive hover:underline"
              >
                {cancelando && <Loader2 className="h-3 w-3 animate-spin" />}
                Cancelar ejecución
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
