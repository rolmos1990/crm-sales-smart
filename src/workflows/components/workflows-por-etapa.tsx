"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Info, Loader2, Workflow } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSesion } from "@/shared/auth/sesion-context";
import { obtenerDisparadoresAction } from "@/crm/pipeline/disparadores/actions";
import { asignarWorkflowAEtapa, obtenerAsignacionesPipelineAction } from "../actions";
import { SelectSimple } from "./editor/campos";

const SIN_WORKFLOW = "__ninguno__";

interface EtapaResumen {
  id: string;
  nombre: string;
  color: string | null;
}

// Pestaña "Workflows" de la configuración del pipeline: qué Workflow corre
// cuando una oportunidad entra a cada etapa.
export function WorkflowsPorEtapa({ pipelineId, stages }: { pipelineId: string; stages: EtapaResumen[] }) {
  const { puedeModificar } = useSesion();
  const editable = puedeModificar("workflows");
  const [cargando, setCargando] = useState(true);
  const [workflows, setWorkflows] = useState<{ id: string; nombre: string }[]>([]);
  const [asignados, setAsignados] = useState<Record<string, string>>({});
  const [disparadoresPorEtapa, setDisparadoresPorEtapa] = useState<Record<string, number>>({});
  const [guardandoEtapa, setGuardandoEtapa] = useState<string | null>(null);
  const [, startGuardar] = useTransition();

  useEffect(() => {
    let vigente = true;
    Promise.all([obtenerAsignacionesPipelineAction(pipelineId), obtenerDisparadoresAction(pipelineId)])
      .then(([r, disparadores]) => {
        if (!vigente) return;
        setWorkflows(r.workflows);
        setAsignados(Object.fromEntries(r.asignaciones.filter((a) => a.stageId).map((a) => [a.stageId!, a.workflowId])));
        const conteo: Record<string, number> = {};
        for (const d of disparadores) if (d.activo) conteo[d.stageId] = (conteo[d.stageId] ?? 0) + 1;
        setDisparadoresPorEtapa(conteo);
      })
      .catch(() => toast.error("No se pudieron cargar los Workflows"))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [pipelineId]);

  const asignar = (stageId: string, valor: string) => {
    const workflowId = valor === SIN_WORKFLOW ? null : valor;
    const anterior = asignados[stageId];
    setAsignados((a) => {
      const nuevo = { ...a };
      if (workflowId) nuevo[stageId] = workflowId;
      else delete nuevo[stageId];
      return nuevo;
    });
    setGuardandoEtapa(stageId);
    startGuardar(async () => {
      const r = await asignarWorkflowAEtapa({ pipelineId, stageId, workflowId });
      setGuardandoEtapa(null);
      if (!r.exito) {
        toast.error(r.error);
        setAsignados((a) => {
          const revertido = { ...a };
          if (anterior) revertido[stageId] = anterior;
          else delete revertido[stageId];
          return revertido;
        });
        return;
      }
      toast.success(workflowId ? "Workflow asignado a la etapa" : "Workflow quitado de la etapa");
    });
  };

  const opciones = [
    { valor: SIN_WORKFLOW, etiqueta: "Sin Workflow" },
    ...workflows.map((w) => ({ valor: w.id, etiqueta: w.nombre })),
  ];

  return (
    <div className="flex max-w-2xl flex-col gap-4" data-slot="workflows-por-etapa">
      <div className="flex gap-2 rounded-xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          El Workflow de una etapa se inicia cuando una oportunidad entra a ella (desde el Kanban, el Inbox, un disparador
          o un lead nuevo). Al salir de la etapa, lo pendiente de ese Workflow se cancela. Solo se listan Workflows
          publicados cuyo Inicio acepta “Entrada a una etapa”.{" "}
          <Link href="/crm/workflows" className="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-4 hover:underline">
            Ver Workflows <ExternalLink className="h-3 w-3" />
          </Link>
        </p>
      </div>

      {cargando ? (
        <div className="space-y-2">
          {stages.map((s) => (
            <Skeleton key={s.id} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {stages.map((stage) => (
            <li key={stage.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color ?? "var(--muted-foreground)" }} />
                <span className="truncate text-sm font-medium">{stage.nombre}</span>
                {disparadoresPorEtapa[stage.id] ? (
                  <span
                    className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                    title="Los disparadores de la etapa también se ejecutan, de forma independiente al Workflow."
                  >
                    + {disparadoresPorEtapa[stage.id]} disparador{disparadoresPorEtapa[stage.id] === 1 ? "" : "es"}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 sm:w-64">
                {guardandoEtapa === stage.id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                {editable ? (
                  <SelectSimple valor={asignados[stage.id] ?? SIN_WORKFLOW} opciones={opciones} onChange={(v) => asignar(stage.id, v)} />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {workflows.find((w) => w.id === asignados[stage.id])?.nombre ?? "Sin Workflow"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
