"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings2, CheckCheck, KanbanSquare, ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PipelineSwitcher } from "./pipeline-switcher";
import { PanelConfigPipeline } from "./panel-config-pipeline";
import { PipelineKanbanDinamico } from "./pipeline-kanban-dinamico";
import { PipelineKanban } from "./pipeline-kanban";
import type { PipelineConStages, OportunidadEnStage } from "../types";
import type { Oportunidad, Etapa } from "@/crm/oportunidades/types";
import type { OpcionCombobox } from "@/shared/ui/combobox";

interface PipelineWrapperProps {
  pipelines: PipelineConStages[];
  pipelineActualId: string | null;
  oportunidadesDinamicas: Map<string, OportunidadEnStage[]> | null;
  oportunidadesLegacy: Map<Etapa, Oportunidad[]> | null;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
}

export function PipelineWrapper({
  pipelines: pipelinesIniciales,
  pipelineActualId,
  oportunidadesDinamicas,
  oportunidadesLegacy,
  empresas,
  contactos,
}: PipelineWrapperProps) {
  const router = useRouter();
  const [modoConfig, setModoConfig] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineConStages[]>(pipelinesIniciales);

  const pipelineActual = pipelines.find((p) => p.id === pipelineActualId) ?? null;
  const esDinamico = !!pipelineActual;

  const handleSwitch = (id: string | null) => {
    setModoConfig(false);
    const url = id ? `/crm/pipeline?p=${id}` : "/crm/pipeline";
    router.push(url);
  };

  const handlePipelineActualizado = (actualizado: PipelineConStages) => {
    setPipelines((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)));
  };

  const handlePipelineEliminado = () => {
    setPipelines((prev) => prev.filter((p) => p.id !== pipelineActualId));
    setModoConfig(false);
    router.push("/crm/pipeline");
  };

  return (
    <div className="flex flex-col gap-4 p-6 h-full overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <PipelineSwitcher
          pipelines={pipelines}
          pipelineActualId={pipelineActualId}
          onSwitch={handleSwitch}
          onConfigurar={esDinamico ? () => setModoConfig(true) : undefined}
        />

        <div className="flex-1" />

        {/* Modo config: botón "Listo" */}
        {modoConfig && esDinamico && (
          <Button
            onClick={() => setModoConfig(false)}
            className={cn(
              "h-9 px-3 rounded-xl gap-2 text-sm",
              "bg-lime-500/10 dark:bg-lime-400/10 border border-lime-500/25 dark:border-lime-400/25",
              "text-lime-700 dark:text-lime-400 hover:bg-lime-500/15 dark:hover:bg-lime-400/15"
            )}
          >
            <CheckCheck className="h-4 w-4" />
            Listo
          </Button>
        )}

        {/* Nueva oportunidad */}
        <ButtonLink
          href={
            esDinamico && pipelineActual?.stages[0]
              ? `/crm/oportunidades/nueva?pipelineId=${pipelineActual.id}&stageId=${pipelineActual.stages[0].id}`
              : "/crm/oportunidades/nueva"
          }
          className="h-9 px-3 rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950 shadow-sm gap-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          Nueva oportunidad
        </ButtonLink>
      </div>

      {/* ── Cuerpo ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {/* Modo configuración */}
        {modoConfig && pipelineActual && (
          <div className="h-full overflow-y-auto">
            <div className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/4 dark:backdrop-blur-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={() => setModoConfig(false)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                  Configuración del pipeline
                </span>
              </div>
              <PanelConfigPipeline
                pipeline={pipelineActual}
                onPipelineActualizado={handlePipelineActualizado}
                onPipelineEliminado={handlePipelineEliminado}
              />
            </div>
          </div>
        )}

        {/* Kanban dinámico */}
        {!modoConfig && esDinamico && pipelineActual && (
          pipelineActual.stages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <KanbanSquare className="h-10 w-10 text-stone-300 dark:text-stone-600" />
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
                Este pipeline no tiene etapas todavía
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModoConfig(true)}
                className="rounded-xl border border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 gap-2"
              >
                <Settings2 className="h-4 w-4" />
                Configurar etapas
              </Button>
            </div>
          ) : (
            <PipelineKanbanDinamico
              pipeline={pipelineActual}
              oportunidadesPorStage={oportunidadesDinamicas ?? new Map()}
              empresas={empresas}
              contactos={contactos}
            />
          )
        )}

        {/* Kanban clásico (legacy enum) */}
        {!modoConfig && !esDinamico && (
          oportunidadesLegacy && [...oportunidadesLegacy.values()].some((v) => v.length > 0) ? (
            <PipelineKanban
              oportunidades={oportunidadesLegacy}
              empresas={empresas}
              contactos={contactos}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <KanbanSquare className="h-10 w-10 text-stone-300 dark:text-stone-600" />
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
                Pipeline vacío
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-600">
                Crea oportunidades o crea un pipeline personalizado
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
