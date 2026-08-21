"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus, Settings2, CheckCheck, KanbanSquare, ArrowLeft, SearchX, EyeOff } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { useAutoRefresh } from "@/shared/hooks/use-auto-refresh";
import { IndicadorAutoRefresh } from "@/shared/components/indicador-auto-refresh";

interface PipelineWrapperProps {
  pipelines: PipelineConStages[];
  pipelineActualId: string | null;
  oportunidadesDinamicas: Map<string, OportunidadEnStage[]> | null;
  totalesPorStage?: Map<string, number> | null;
  /** Conteo real por etapa (no el cargado) — ver pipeline-kanban-dinamico.tsx. */
  conteoPorStage?: Map<string, number> | null;
  /** Cuántas se pidieron por etapa en esta carga — punto de partida del
   *  "cargar más" al hacer scroll. */
  limitePorStage?: number;
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
  totalesPorStage,
  conteoPorStage,
  limitePorStage = 30,
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
  const vscrollRef = useRef<HTMLDivElement>(null);

  // Scrollbar vertical discreta: invisible en reposo, aparece mientras hay
  // actividad real de scroll (rueda, trackpad, touch, teclado, autoscroll
  // del D&D — cualquier cosa que dispare el evento nativo `scroll`) y se
  // oculta sola tras un breve instante de inactividad — ver reglas de
  // [data-pipeline-vscroll] en globals.css. Alterna una clase directo sobre
  // el DOM (sin useState) para no disparar un render del Pipeline completo
  // en cada evento de scroll; el overflow/scroll en sí no se toca, sigue
  // siendo el mismo `overflow-auto` de siempre.
  useEffect(() => {
    const el = vscrollRef.current;
    if (!el) return;
    let ocultarTimeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      el.classList.add("is-scrolling");
      clearTimeout(ocultarTimeout);
      ocultarTimeout = setTimeout(() => el.classList.remove("is-scrolling"), 700);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(ocultarTimeout);
    };
  }, []);

  const pipelineActual = pipelines.find((p) => p.id === pipelineActualId) ?? null;
  const esDinamico = !!pipelineActual;

  // "Ver ocultos" es un toggle de visibilidad (no un filtro de datos): no hay
  // forma de "filtrar por etapa" en este tablero — cada columna ya es su
  // propia etapa — así que solo necesita combinarse con los filtros del
  // drawer (contacto/empresa/fechas/tags), nunca competir con uno. Vive en la
  // URL para que sea compartible/persista al recargar, igual que los filtros.
  const hayEtapasOcultas = !!pipelineActual?.stages.some((s) => (s.esGanado || s.esPerdido) && !s.visible);
  const verOcultos = searchParams.get("ocultos") === "1";
  const toggleVerOcultos = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (verOcultos) params.delete("ocultos"); else params.set("ocultos", "1");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

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

  // Auto-refresh: vuelve a pedirle al servidor los datos de la ruta actual
  // (router.refresh no navega ni pierde el estado de scroll/UI) para que
  // "nuevoMensaje" y las oportunidades recién llegadas aparezcan solas.
  const { restante, intervaloSegundos, activo, setActivo, cambiarIntervalo } = useAutoRefresh(
    "pipeline-auto-refresh-segundos",
    () => router.refresh()
  );

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

        {!modoConfig && (
          <IndicadorAutoRefresh
            restante={restante}
            intervaloSegundos={intervaloSegundos}
            activo={activo}
            onCambiarIntervalo={cambiarIntervalo}
            onToggleActivo={() => setActivo((v) => !v)}
          />
        )}

        {/* Modo config: botón "Listo" */}
        {modoConfig && esDinamico && (
          <Button
            onClick={() => setModoConfig(false)}
            className={cn(
              "h-8 px-3 rounded-lg gap-1.5 text-[12.5px] font-medium",
              "bg-primary-muted border border-primary-border",
              "text-primary hover:bg-primary-muted/70"
            )}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Listo
          </Button>
        )}

        {/* Ver ocultos — solo si el pipeline tiene etapas Ganado/Perdido ocultas */}
        {!modoConfig && pipelineActual && hayEtapasOcultas && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                onClick={toggleVerOcultos}
                className={cn(
                  "h-8 px-3 rounded-lg gap-1.5 text-[12.5px] font-medium border transition-colors cursor-pointer",
                  verOcultos
                    ? "bg-primary-muted border-primary-border text-primary"
                    : "border-button-secondary-border text-button-secondary-text hover:text-foreground"
                )}
              >
                <EyeOff className="h-3.5 w-3.5" />
                Ver ocultos
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                Muestra las etapas (y sus oportunidades) que están ocultas en este pipeline.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
            className="h-8 px-3 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground shadow-[0_0_14px_color-mix(in_oklab,var(--primary)_30%,transparent)] hover:shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_45%,transparent)] gap-1.5 text-[12.5px] font-semibold transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva oportunidad
          </ButtonLink>
        )}
      </div>

      {/* ── Cuerpo ─────────────────────────────────────────────── */}
      {/* Único contenedor de scroll del Pipeline — vertical Y horizontal a
          la vez (necesario para que los headers sticky de cada etapa se
          anclen a ESTE contenedor y no a KanbanScrollContainer: `sticky`
          solo funciona relativo al ancestro scrolleable más cercano, y con
          overflow-x/overflow-y repartidos en dos contenedores distintos el
          header terminaba "pegado" a una fila que nunca se mueve — ver
          ColumnaStage). El wrapper de afuera (overflow-hidden, altura fija)
          recorta los 20px de más que este div mide de alto a propósito: eso
          empuja la scrollbar horizontal nativa (que el navegador dibuja
          pegada al borde inferior del elemento) fuera del área visible, sin
          tocar `scrollbar-width` — así la vertical sigue viéndose normal y
          la horizontal sigue oculta con el indicador de puntitos, igual que
          antes. El pb-6 extra es colchón para que ese recorte nunca se
          coma contenido real (ver Ganado/Perdido al final del tablero). */}
      <div className="flex-1 overflow-hidden">
        <div ref={vscrollRef} className="h-[calc(100%_+_20px)] overflow-auto pb-6" data-pipeline-vscroll="">
        {/* Modo configuración */}
        {modoConfig && pipelineActual && puedeMod && (
          <div className="h-full overflow-y-auto">
            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={() => setModoConfig(false)}
                  className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
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
              <KanbanSquare className="h-9 w-9 text-muted-foreground/50" />
              <p className="text-[13px] font-medium text-muted-foreground">
                Este pipeline no tiene etapas todavía
              </p>
              {puedeMod && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModoConfig(true)}
                  className="rounded-lg border border-button-secondary-border text-button-secondary-text hover:text-foreground gap-1.5 text-[12px]"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Configurar etapas
                </Button>
              )}
            </div>
          ) : sinResultadosPorFiltros ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <SearchX className="h-9 w-9 text-muted-foreground/50" />
              <p className="text-[13px] font-medium text-muted-foreground">
                No hay oportunidades que coincidan con los filtros.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={limpiarFiltros}
                className="rounded-lg border border-button-secondary-border text-button-secondary-text hover:text-foreground gap-1.5 text-[12px]"
              >
                Limpiar filtros
              </Button>
            </div>
          ) : (
            <PipelineKanbanDinamico
              key={claveKanban}
              pipeline={pipelineActual}
              oportunidadesPorStage={oportunidadesDinamicas ?? new Map()}
              totalesPorStage={totalesPorStage ?? new Map()}
              conteoPorStage={conteoPorStage ?? new Map()}
              limitePorStage={limitePorStage}
              empresas={empresas}
              contactos={contactos}
              defaultCountryCode={defaultCountryCode}
              puedeMod={puedeMod}
              verOcultos={verOcultos}
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
              <KanbanSquare className="h-9 w-9 text-muted-foreground/50" />
              <p className="text-[13px] font-medium text-muted-foreground">
                Pipeline vacío
              </p>
              <p className="text-[11px] text-muted-foreground">
                Crea oportunidades o un pipeline personalizado
              </p>
            </div>
          )
        )}
        </div>
      </div>
    </div>
  );
}
