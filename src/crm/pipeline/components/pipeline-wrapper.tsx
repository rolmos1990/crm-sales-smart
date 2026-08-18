"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus, Settings2, CheckCheck, KanbanSquare, ArrowLeft, SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PipelineSwitcher } from "./pipeline-switcher";
import { PanelConfigPipeline } from "./panel-config-pipeline";
import { PipelineKanbanDinamico } from "./pipeline-kanban-dinamico";
import { PipelineKanban } from "./pipeline-kanban";
import { PipelineFiltrosDrawer } from "./pipeline-filtros-drawer";
import { CLAVES_FILTROS_OPORTUNIDAD } from "../schema";
import type { PipelineConStages, OportunidadEnStage } from "../types";
import type { Oportunidad, Etapa } from "@/crm/oportunidades/types";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import type { Tag } from "@/crm/tags/types";
import { useSesion } from "@/shared/auth/sesion-context";

interface PipelineWrapperProps {
  pipelines: PipelineConStages[];
  pipelineActualId: string | null;
  oportunidadesDinamicas: Map<string, OportunidadEnStage[]> | null;
  oportunidadesLegacy: Map<Etapa, Oportunidad[]> | null;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  contactosFiltro?: OpcionCombobox[];
  tags?: Tag[];
  defaultCountryCode?: string;
  hayFiltrosAplicados?: boolean;
}

export function PipelineWrapper({
  pipelines: pipelinesIniciales,
  pipelineActualId,
  oportunidadesDinamicas,
  oportunidadesLegacy,
  empresas,
  contactos,
  contactosFiltro,
  tags = [],
  defaultCountryCode = "PA",
  hayFiltrosAplicados = false,
}: PipelineWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("oportunidades");
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

  const limpiarFiltros = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const clave of CLAVES_FILTROS_OPORTUNIDAD) params.delete(clave);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  // El Kanban guarda estado local (localOps) para el drag & drop; sin un
  // key que cambie junto con el pipeline/filtros, React lo re-usa entre
  // navegaciones y queda mostrando datos obsoletos.
  const claveKanban = `${pipelineActualId ?? "sin-pipeline"}:${CLAVES_FILTROS_OPORTUNIDAD.map(
    (clave) => searchParams.get(clave) ?? ""
  ).join("|")}`;

  const totalOportunidadesDinamicas = oportunidadesDinamicas
    ? [...oportunidadesDinamicas.values()].reduce((total, arr) => total + arr.length, 0)
    : 0;
  const sinResultadosPorFiltros = hayFiltrosAplicados && totalOportunidadesDinamicas === 0;

  return (
    <div className="flex flex-col gap-4 p-5 h-full overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <PipelineSwitcher
          pipelines={pipelines}
          pipelineActualId={pipelineActualId}
          onSwitch={handleSwitch}
          onConfigurar={esDinamico && puedeMod ? () => setModoConfig(true) : undefined}
        />

        <div className="flex-1" />

        {/* Modo config: botón "Listo" */}
        {modoConfig && esDinamico && (
          <Button
            onClick={() => setModoConfig(false)}
            className={cn(
              "h-8 px-3 rounded-lg gap-1.5 text-[12.5px] font-medium",
              "bg-lime-500/[0.1] dark:bg-lime-400/[0.08] border border-lime-500/20 dark:border-lime-400/20",
              "text-lime-700 dark:text-lime-400 hover:bg-lime-500/[0.15] dark:hover:bg-lime-400/[0.12]"
            )}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Listo
          </Button>
        )}

        {/* Filtros */}
        {!modoConfig && pipelineActual && pipelineActual.stages.length > 0 && (
          <PipelineFiltrosDrawer
            contactos={contactosFiltro ?? contactos}
            empresas={empresas}
            tags={tags}
          />
        )}

        {/* Nueva oportunidad */}
        {puedeMod && (
          <ButtonLink
            href={
              esDinamico && pipelineActual?.stages[0]
                ? `/crm/oportunidades/nueva?pipelineId=${pipelineActual.id}&stageId=${pipelineActual.stages[0].id}`
                : "/crm/oportunidades/nueva"
            }
            className="h-8 px-3 rounded-lg bg-lime-500 hover:bg-lime-400 text-stone-950 shadow-[0_0_14px_rgba(132,204,22,0.3)] hover:shadow-[0_0_20px_rgba(132,204,22,0.45)] gap-1.5 text-[12.5px] font-semibold transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva oportunidad
          </ButtonLink>
        )}
      </div>

      {/* ── Cuerpo ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {/* Modo configuración */}
        {modoConfig && pipelineActual && puedeMod && (
          <div className="h-full overflow-y-auto">
            <div className="rounded-xl border border-stone-200 dark:border-white/[0.07] bg-white dark:bg-[oklch(0.110_0.003_264)] p-6">
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={() => setModoConfig(false)}
                  className="h-6 w-6 flex items-center justify-center rounded-md text-stone-400 dark:text-white/30 hover:text-stone-600 dark:hover:text-white/70 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-semibold text-stone-400 dark:text-white/25 uppercase tracking-[0.08em]">
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
              <KanbanSquare className="h-9 w-9 text-stone-300 dark:text-white/[0.08]" />
              <p className="text-[13px] font-medium text-stone-500 dark:text-white/35">
                Este pipeline no tiene etapas todavía
              </p>
              {puedeMod && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModoConfig(true)}
                  className="rounded-lg border border-stone-200 dark:border-white/[0.08] text-stone-500 dark:text-white/40 hover:text-stone-700 dark:hover:text-white/70 gap-1.5 text-[12px]"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Configurar etapas
                </Button>
              )}
            </div>
          ) : sinResultadosPorFiltros ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <SearchX className="h-9 w-9 text-stone-300 dark:text-white/[0.08]" />
              <p className="text-[13px] font-medium text-stone-500 dark:text-white/35">
                No hay oportunidades que coincidan con los filtros.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={limpiarFiltros}
                className="rounded-lg border border-stone-200 dark:border-white/[0.08] text-stone-500 dark:text-white/40 hover:text-stone-700 dark:hover:text-white/70 gap-1.5 text-[12px]"
              >
                Limpiar filtros
              </Button>
            </div>
          ) : (
            <PipelineKanbanDinamico
              key={claveKanban}
              pipeline={pipelineActual}
              oportunidadesPorStage={oportunidadesDinamicas ?? new Map()}
              empresas={empresas}
              contactos={contactos}
              defaultCountryCode={defaultCountryCode}
              puedeMod={puedeMod}
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
              defaultCountryCode={defaultCountryCode}
              puedeMod={puedeMod}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <KanbanSquare className="h-9 w-9 text-stone-300 dark:text-white/[0.08]" />
              <p className="text-[13px] font-medium text-stone-500 dark:text-white/35">
                Pipeline vacío
              </p>
              <p className="text-[11px] text-stone-400 dark:text-white/20">
                Crea oportunidades o un pipeline personalizado
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
