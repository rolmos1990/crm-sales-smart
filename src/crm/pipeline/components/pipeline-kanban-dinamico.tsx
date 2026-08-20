"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Building2, Plus, User, Receipt, Trophy, XCircle, Loader2, FileText, FileCheck2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMoverAStageMutation } from "@/crm/oportunidades/hooks";
import { cn } from "@/lib/utils";
import type { PipelineConStages, PipelineStage, OportunidadEnStage } from "../types";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import { WorkspaceOportunidad } from "@/crm/oportunidades/components/workspace-oportunidad";
import type { Oportunidad } from "@/crm/oportunidades/types";
import { KanbanScrollContainer } from "./kanban-scroll-container";

const formatearMoneda = (valor: number, moneda: string) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(valor);

// ── Insignia de cotización ────────────────────────────────────────
// Gris = tiene cotización pero ninguna aprobada todavía (Borrador, Revisada,
// Enviada, Rechazada, Vencida). Verde = ya hay una cotización Aprobada (esa
// es la que genera el pedido). Sin cotización, no se muestra nada.
function InsigniaCotizacion({ estado }: { estado: OportunidadEnStage["estadoCotizacion"] }) {
  if (!estado) return null;
  const aprobada = estado === "APROBADA";
  return (
    <span
      title={aprobada ? "Cotización aprobada" : "Cotización pendiente de aprobación"}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
        aprobada
          ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:bg-emerald-400/10 dark:border-emerald-400/20 dark:text-emerald-400"
          : "bg-stone-100 border-stone-200 text-stone-400 dark:bg-white/[0.05] dark:border-white/[0.08] dark:text-white/30"
      )}
    >
      {aprobada ? <FileCheck2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
    </span>
  );
}

// ── Tarjeta draggable ─────────────────────────────────────────────

function TarjetaOportunidad({
  oportunidad,
  stageColor,
  onCardClick,
  puedeMod = true,
}: {
  oportunidad: OportunidadEnStage;
  stageColor: string;
  onCardClick: (op: OportunidadEnStage) => void;
  puedeMod?: boolean;
}) {
  // useSortable (no useDraggable): además de arrastrar, participa de un
  // SortableContext por columna — eso es lo que anima el "hacer espacio"
  // (las demás tarjetas se corren solas) cuando pasa por encima o cambia de
  // etapa, sin tener que calcular nada de eso a mano.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: oportunidad.id,
    data: oportunidad,
  });

  // Solo se anima `transform` (posición) acá — dnd-kit ya trae la curva
  // correcta en `transition`. El resto (opacidad, anillo) lo anima la propia
  // clase `transition-all` de la tarjeta, más abajo.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      data-testid="oportunidad-card"
      style={style}
      className="mb-2 touch-none"
      {...(puedeMod ? attributes : {})}
      {...(puedeMod ? listeners : {})}
      onClick={() => onCardClick(oportunidad)}
    >
      <div
        className={cn(
          "block cursor-pointer rounded-xl border select-none",
          "bg-white dark:bg-[oklch(0.130_0.004_264)]",
          "shadow-sm dark:shadow-[0_2px_10px_-6px_rgba(0,0,0,0.55)]",
          "hover:shadow-sm dark:hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.7)]",
          "transition-all duration-150 p-3.5 space-y-3",
          // Se está arrastrando: transparencia (queda leyéndose como el
          // "hueco" que marca dónde va a caer) + borde resaltado — mismo
          // tamaño y forma de siempre, nada de escalar ni rotar acá (eso lo
          // hace la copia flotante de <TarjetaOverlay>, ver DragOverlay).
          isDragging && "opacity-40 shadow-none ring-2 ring-lime-400/70 dark:ring-lime-400/50"
        )}
        style={{ borderColor: `${stageColor}35` }}
      >
        {/* Indicador de etapa — línea fina, color desaturado, sin resplandor */}
        <div
          className="h-[2px] rounded-full -mt-0.5 mb-0.5"
          style={{ backgroundColor: stageColor, opacity: 0.5 }}
        />

        {/* Identidad: qué pide el cliente (título) + quién es (contacto / empresa) */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-semibold leading-snug line-clamp-2 text-stone-900 dark:text-white/90">
              {oportunidad.titulo}
            </p>
            <InsigniaCotizacion estado={oportunidad.estadoCotizacion} />
          </div>
          {(oportunidad.contacto || oportunidad.empresa) && (
            <div className="space-y-0.5">
              {oportunidad.contacto && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <User className="h-3 w-3 shrink-0 text-stone-400 dark:text-white/30" />
                  <span className="text-[12px] text-stone-500 dark:text-white/40 truncate">
                    {oportunidad.contacto.nombre} {oportunidad.contacto.apellido}
                  </span>
                </div>
              )}
              {oportunidad.empresa && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building2 className="h-3 w-3 shrink-0 text-stone-400 dark:text-white/30" />
                  <span className="text-[12px] text-stone-500 dark:text-white/40 truncate">
                    {oportunidad.empresa.nombre}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Separador sutil entre identidad e información comercial */}
        <div className="border-t border-stone-100 dark:border-white/[0.05]" />

        {/* Monto (izquierda) + vencimiento (derecha, cápsula neutral) */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold tabular-nums text-stone-900 dark:text-white/90">
            {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
          </span>
          {oportunidad.fechaCierre && (
            <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 dark:border-white/[0.08] bg-stone-50 dark:bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] font-medium text-stone-500 dark:text-white/40 shrink-0">
              <CalendarDays className="h-3 w-3 shrink-0" />
              Vence {format(new Date(oportunidad.fechaCierre), "dd MMM", { locale: es })}
            </span>
          )}
        </div>

        {/* Etiquetas — diseño neutral, sin límite de cantidad */}
        {oportunidad.tags && oportunidad.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {oportunidad.tags.map(({ tagId, tag }) => (
              <span
                key={tagId}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 dark:border-white/[0.08] bg-stone-100/80 dark:bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:text-white/50"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color ?? "#78716c", opacity: 0.75 }}
                />
                {tag.nombre}
              </span>
            ))}
          </div>
        )}

        {/* Progreso — relleno del color de etapa desaturado, sin resplandor */}
        <div className="flex items-center gap-2.5">
          <div className="flex-1 bg-stone-100 dark:bg-white/[0.07] rounded-full h-1 overflow-hidden">
            <div
              className="rounded-full h-1 transition-all"
              style={{ width: `${oportunidad.probabilidad}%`, backgroundColor: stageColor, opacity: 0.55 }}
            />
          </div>
          <span className="text-[10px] font-medium text-stone-400 dark:text-white/30 tabular-nums w-7 text-right">
            {oportunidad.probabilidad}%
          </span>
          {oportunidad.nuevoMensaje && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80 dark:bg-emerald-400/70 shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaOverlay({ oportunidad }: { oportunidad: OportunidadEnStage }) {
  return (
    // Sin rotación — solo un scale leve (reducción) + opacidad, para que se
    // lea como "levantada del tablero" sin verse deformada. El transform acá
    // es puramente cosmético (escala): el posicionamiento real sobre el
    // cursor lo maneja el propio DragOverlay de dnd-kit por fuera de este nodo.
    <div className="w-[272px] scale-[0.97] opacity-95 rounded-xl border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[oklch(0.155_0.004_264)] shadow-[0_16px_32px_-10px_rgba(0,0,0,0.5)] p-3.5 space-y-2">
      <p className="text-[14px] font-semibold line-clamp-1 text-stone-900 dark:text-white/90">
        {oportunidad.titulo}
      </p>
      <p className="text-[15px] font-semibold text-stone-900 dark:text-white/90 tabular-nums">
        {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
      </p>
      {oportunidad.contacto && (
        <p className="text-[12px] text-stone-500 dark:text-white/40">
          {oportunidad.contacto.nombre} {oportunidad.contacto.apellido}
        </p>
      )}
      {oportunidad.empresa && (
        <p className="text-[12px] text-stone-500 dark:text-white/40">{oportunidad.empresa.nombre}</p>
      )}
    </div>
  );
}

// ── Columna droppable ─────────────────────────────────────────────

function ColumnaStage({
  stage,
  items,
  total,
  conteo,
  pipelineId,
  onCardClick,
  puedeMod = true,
  resaltada = false,
}: {
  stage: PipelineStage;
  items: OportunidadEnStage[];
  total: number;
  /** Conteo real de la etapa (no solo lo cargado en pantalla) — ver
   *  obtenerConteoPorStage. Cae a items.length si todavía no llegó. */
  conteo: number;
  pipelineId: string;
  onCardClick: (op: OportunidadEnStage) => void;
  puedeMod?: boolean;
  /** La tarjeta que se está arrastrando ya vive (en vivo) dentro de `items`
   *  — es decir, esta es la columna que la recibiría si se suelta ahora. Se
   *  calcula en el padre a partir de `localOps`, no solo del `isOver` de acá
   *  abajo: ese `isOver` únicamente es true al pasar sobre el área vacía del
   *  contenedor, no sobre otra tarjeta — con `resaltada` la columna se
   *  ilumina también al pasar por encima de sus propias tarjetas. */
  resaltada?: boolean;
}) {
  const { setNodeRef, isOver: isOverContenedor } = useDroppable({ id: stage.id });
  const isOver = isOverContenedor || resaltada;
  const color = stage.color ?? "#818cf8";

  return (
    // h-full: junto con el `align-items: stretch` por defecto de la fila en
    // KanbanScrollContainer, hace que TODAS las columnas lleguen hasta la
    // altura de la más alta (la de más tarjetas) — así una etapa con pocas
    // oportunidades sigue siendo un blanco de suelta grande, no solo el
    // recuadro chico alrededor de sus 2-3 tarjetas.
    <div className="flex-shrink-0 w-[272px] h-full" data-testid="pipeline-column">
      <div
        className={cn(
          "flex h-full flex-col rounded-xl border overflow-hidden transition-all duration-150",
          "bg-stone-100/50 dark:bg-[oklch(0.095_0.003_264)]",
          "border-stone-200/70 dark:border-white/[0.06]",
          // Hover del drag: además del anillo, un tinte leve de fondo en el
          // color de la propia etapa — "se ilumina" sin gritar.
          isOver && "ring-1 dark:ring-offset-[oklch(0.063_0.002_264)]"
        )}
        style={isOver ? { "--tw-ring-color": `${color}30`, backgroundColor: `${color}08` } as React.CSSProperties : undefined}
      >
        {/* Línea de color del stage */}
        <div className="h-[2px] flex-shrink-0 opacity-70" style={{ backgroundColor: color }} />

        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: `${color}15`,
                  color: color,
                }}
              >
                {stage.nombre}
              </span>
              <span
                className="inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 rounded bg-stone-200 dark:bg-white/[0.08] text-[10px] font-bold text-stone-500 dark:text-white/40"
                title={items.length < conteo ? `${items.length} de ${conteo} cargadas` : undefined}
              >
                {items.length < conteo ? `${items.length}/${conteo}` : conteo}
              </span>
            </div>
            {puedeMod && (
              <Link
                href={`/crm/oportunidades/nueva?pipelineId=${pipelineId}&stageId=${stage.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-md text-stone-400 dark:text-white/30 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-white/[0.08]"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" data-testid="column-total">
            <Receipt className="h-3 w-3 shrink-0 text-stone-400 dark:text-white/25" />
            <span className="text-stone-400 dark:text-white/30 font-medium">Total</span>
            <span className="font-semibold tabular-nums text-stone-600 dark:text-white/60">
              {formatearMoneda(total, "PEN")}
            </span>
          </div>
        </div>

        {/* flex-1: ocupa todo el resto de la altura de la columna (ver h-full
            más arriba) — el espacio vacío bajo la última tarjeta sigue
            siendo parte del droppable, no solo el borde ceñido a las
            tarjetas cargadas. Sin scroll propio — la columna crece con su
            contenido; el único scroll vertical del Pipeline vive en el
            contenedor de más arriba (ver pipeline-wrapper.tsx,
            data-pipeline-vscroll). */}
        <div ref={setNodeRef} className="flex-1 px-2.5 pb-2.5 min-h-[80px]">
          {items.length === 0 ? (
            <div
              className={cn(
                "rounded-lg border border-dashed py-6 text-center text-[11px] transition-all",
                isOver ? "font-medium" : "border-stone-300/60 dark:border-white/[0.06] text-stone-400 dark:text-white/20"
              )}
              style={isOver ? { borderColor: `${color}40`, color, backgroundColor: `${color}06` } : undefined}
            >
              {isOver ? "Soltar aquí" : "Sin oportunidades"}
            </div>
          ) : (
            <SortableContext items={items.map((op) => op.id)} strategy={verticalListSortingStrategy}>
              {items.map((op) => (
                <TarjetaOportunidad
                  key={op.id}
                  oportunidad={op}
                  stageColor={color}
                  onCardClick={onCardClick}
                  puedeMod={puedeMod}
                />
              ))}
            </SortableContext>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Zonas rápidas Ganado/Perdido ────────────────────────────────────
// Ids centinela (no ids de etapa reales) — evita choques con el droppable de
// la columna real cuando esa etapa también está visible en el tablero (ej.
// con "Ver ocultos" activo). handleDragEnd los resuelve al id real.
const ZONA_GANADO_ID = "__zona_ganado__";
const ZONA_PERDIDO_ID = "__zona_perdido__";

function ZonaSoltarResultado({
  stage,
  tipo,
  dragging,
}: {
  stage: PipelineStage;
  tipo: "ganado" | "perdido";
  /** Hay una tarjeta en vuelo (cualquiera) — activa el tinte de color. Sin
   *  esto la zona queda neutra incluso arrastrando, ver estado normal. */
  dragging: boolean;
}) {
  const esGanado = tipo === "ganado";
  const { setNodeRef, isOver } = useDroppable({ id: esGanado ? ZONA_GANADO_ID : ZONA_PERDIDO_ID });
  const Icono = esGanado ? Trophy : XCircle;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 rounded-xl border border-dashed transition-all duration-200",
        "flex items-center justify-center gap-2 py-3",
        // Estado normal — discreto, casi transparente, no compite con las columnas.
        !dragging && "border-stone-200/60 dark:border-white/[0.06] bg-stone-50/40 dark:bg-white/[0.015]",
        // Hay un drag en curso (en cualquier parte del tablero) — un poco más
        // de presencia y el color empieza a insinuarse, sin gritar todavía.
        dragging && !isOver && esGanado && "border-emerald-400/40 dark:border-emerald-400/30 bg-emerald-50/60 dark:bg-emerald-500/[0.06]",
        dragging && !isOver && !esGanado && "border-red-400/40 dark:border-red-400/30 bg-red-50/60 dark:bg-red-500/[0.06]",
        // La tarjeta está justo encima de esta zona — feedback inmediato y claro.
        isOver && esGanado && "border-solid border-emerald-400 dark:border-emerald-400/80 bg-emerald-100/80 dark:bg-emerald-500/[0.16] scale-[1.01]",
        isOver && !esGanado && "border-solid border-red-400 dark:border-red-400/80 bg-red-100/80 dark:bg-red-500/[0.16] scale-[1.01]"
      )}
    >
      <Icono
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-colors",
          !dragging
            ? "text-stone-400 dark:text-white/25"
            : esGanado ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        )}
      />
      <p
        className={cn(
          "text-[12px] font-semibold transition-colors",
          !dragging
            ? "text-stone-500 dark:text-white/40"
            : esGanado ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
        )}
      >
        {stage.nombre}
      </p>
      <p className="text-[11px] text-stone-400 dark:text-white/25">
        · Suelta aquí las oportunidades {esGanado ? "ganadas" : "perdidas"}
      </p>
    </div>
  );
}

function ZonasResultadoRapido({
  stageGanado,
  stagePerdido,
  dragging,
}: {
  stageGanado?: PipelineStage;
  stagePerdido?: PipelineStage;
  dragging: boolean;
}) {
  if (!stageGanado && !stagePerdido) return null;
  return (
    <div className="mt-4 flex gap-3">
      {stageGanado && <ZonaSoltarResultado stage={stageGanado} tipo="ganado" dragging={dragging} />}
      {stagePerdido && <ZonaSoltarResultado stage={stagePerdido} tipo="perdido" dragging={dragging} />}
    </div>
  );
}

// ── Kanban principal ──────────────────────────────────────────────

interface PipelineKanbanDinamicoProps {
  pipeline: PipelineConStages;
  oportunidadesPorStage: Map<string, OportunidadEnStage[]>;
  totalesPorStage?: Map<string, number>;
  /** Conteo real por etapa (no solo lo cargado) — ver obtenerConteoPorStage. */
  conteoPorStage?: Map<string, number>;
  /** Cuántas se pidieron por etapa en esta carga (?limite= en la URL) —
   *  punto de partida para "cargar más" al llegar al final del scroll. */
  limitePorStage?: number;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  defaultCountryCode?: string;
  puedeMod?: boolean;
  /** "Ver ocultos" activo — muestra también las columnas Ganado/Perdido con
   *  visible=false (ver panel-config-pipeline.tsx), que por defecto quedan
   *  fuera del tablero. */
  verOcultos?: boolean;
}

export function PipelineKanbanDinamico({
  pipeline,
  oportunidadesPorStage,
  totalesPorStage = new Map(),
  conteoPorStage = new Map(),
  limitePorStage = 30,
  empresas,
  contactos,
  defaultCountryCode = "PA",
  puedeMod = true,
  verOcultos = false,
}: PipelineKanbanDinamicoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localOps, setLocalOps] = useState(oportunidadesPorStage);
  const [localTotales, setLocalTotales] = useState(totalesPorStage);
  const [localConteos, setLocalConteos] = useState(conteoPorStage);
  const [activeCard, setActiveCard] = useState<OportunidadEnStage | null>(null);
  // Etapa de origen de la tarjeta activa, capturada al agarrarla — `onDragOver`
  // va moviendo la tarjeta en vivo entre columnas mientras se arrastra, así
  // que al soltar ya no alcanza con mirar su `stageId` (quedó desactualizado);
  // esto es lo que permite saber si de verdad cambió de etapa.
  const [activeOriginStageId, setActiveOriginStageId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ id: string; stageId: string | null } | null>(null);
  const [cargandoMas, startCargandoMas] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Foto de `localOps` justo antes de empezar a arrastrar — si el drag se
  // cancela o se suelta fuera de cualquier destino válido, se vuelve a esto
  // en vez de dejar el tablero a mitad de un reordenamiento en vivo.
  const dragSnapshotRef = useRef<Map<string, OportunidadEnStage[]> | null>(null);
  const moverMutation = useMoverAStageMutation();

  // Resincroniza con los datos frescos del servidor (ej. tras el auto-refresh
  // periódico, que trae nuevoMensaje/oportunidades actualizadas, o tras subir
  // ?limite= al "cargar más" — ver más abajo) — pero nunca mientras hay un
  // drag en curso, para no pisar el estado optimista a mitad de un movimiento.
  useEffect(() => {
    if (!activeCard) setLocalOps(oportunidadesPorStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oportunidadesPorStage]);

  useEffect(() => {
    if (!activeCard) setLocalTotales(totalesPorStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalesPorStage]);

  useEffect(() => {
    if (!activeCard) setLocalConteos(conteoPorStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteoPorStage]);

  // Las etapas Ganado/Perdido con visible=false no se muestran como columna,
  // pero la oportunidad se sigue pudiendo mover ahí (drag a otra vía o popover
  // "Mover a") — "Ver ocultos" las trae de vuelta al tablero sin tocar la
  // configuración del pipeline.
  const stagesColumnas = verOcultos
    ? pipeline.stages
    : pipeline.stages.filter((s) => !(s.esGanado || s.esPerdido) || s.visible);

  // Etapas destino de las zonas rápidas "Ganado"/"Perdido" que aparecen al
  // arrastrar — si el pipeline tiene más de una marcada, se usa la primera.
  const stageGanado = pipeline.stages.find((s) => s.esGanado);
  const stagePerdido = pipeline.stages.find((s) => s.esPerdido);

  // Paginación por etapa: el servidor solo trae `limitePorStage` tarjetas de
  // cada columna visible (ver obtenerOportunidadesPorPipeline) — si alguna
  // etapa tiene más que eso sin cargar, sigue habiendo "más" que traer.
  const hayMasPorCargar = stagesColumnas.some(
    (s) => (localConteos.get(s.id) ?? 0) > (localOps.get(s.id)?.length ?? 0)
  );

  // "Cargar más" = subir ?limite= en la URL y dejar que Next vuelva a pedirle
  // al Server Component los datos (misma ruta que ya usan los filtros y "Ver
  // ocultos") — no un fetch aparte: así el resultado se resincroniza solo con
  // el useEffect de arriba, sin duplicar lógica de merge ni arriesgar quedar
  // desalineado con el auto-refresh o un cambio de filtro.
  const cargarMas = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("limite", String(limitePorStage + 10));
    startCargandoMas(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  // Dispara cargarMas cuando el centinela (al pie del tablero, debajo de las
  // columnas) entra en el viewport real del navegador — que es justo lo que
  // pasa al hacer scroll en el único contenedor vertical del Pipeline (ver
  // pipeline-wrapper.tsx). rootMargin adelanta la carga antes de llegar
  // literalmente al fondo, para que no se sienta un salto.
  useEffect(() => {
    if (!hayMasPorCargar) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !cargandoMas) cargarMas();
      },
      // top/right/bottom/left — crece el margen inferior para disparar la
      // carga un poco antes de llegar literalmente al final (sin esto se
      // siente un salto/parón justo al tocar el fondo).
      { rootMargin: "0px 0px 600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayMasPorCargar, cargandoMas, limitePorStage]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Encuentra en qué columna vive ahora mismo un id — puede ser el id de una
  // etapa (se soltó sobre el contenedor: columna vacía, o el hueco debajo de
  // la última tarjeta) o el id de otra tarjeta (se soltó sobre/entre otras).
  const encontrarStageDe = (id: string, ops: Map<string, OportunidadEnStage[]>): string | null => {
    if (ops.has(id)) return id;
    for (const [stageId, items] of ops) {
      if (items.some((o) => o.id === id)) return stageId;
    }
    return null;
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const op = active.data.current as OportunidadEnStage;
    setActiveCard(op);
    setActiveOriginStageId(op.stageId ?? "__sin_stage__");
    dragSnapshotRef.current = localOps;
  };

  // Va reacomodando las tarjetas EN VIVO mientras se arrastra — cruzar a otra
  // columna la saca de la lista de origen y la inserta en la de destino (en
  // la posición sobre la que está el cursor); dentro de la misma columna,
  // reordena con arrayMove. El único id que dnd-kit necesita comparar es el
  // de las tarjetas — el cambio de array ya dispara la animación de "hacer
  // espacio" del propio SortableContext, no hay que animar nada a mano.
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    // Las zonas rápidas Ganado/Perdido no son columnas del tablero — se
    // resuelven solo al soltar (ver handleDragEnd), no participan del
    // reordenamiento en vivo.
    if (overId === ZONA_GANADO_ID || overId === ZONA_PERDIDO_ID || activeId === overId) return;

    setLocalOps((prev) => {
      const origenKey = encontrarStageDe(activeId, prev);
      const destinoEsContenedor = prev.has(overId);
      const destinoKey = destinoEsContenedor ? overId : encontrarStageDe(overId, prev);
      if (!origenKey || !destinoKey) return prev;

      const origenItems = prev.get(origenKey) ?? [];
      const activeIndex = origenItems.findIndex((o) => o.id === activeId);
      if (activeIndex === -1) return prev;

      if (origenKey === destinoKey) {
        const overIndex = destinoEsContenedor ? origenItems.length - 1 : origenItems.findIndex((o) => o.id === overId);
        if (overIndex === -1 || activeIndex === overIndex) return prev;
        const next = new Map(prev);
        next.set(origenKey, arrayMove(origenItems, activeIndex, overIndex));
        return next;
      }

      const destinoItems = prev.get(destinoKey) ?? [];
      const overIndex = destinoEsContenedor ? destinoItems.length : destinoItems.findIndex((o) => o.id === overId);
      const insertarEn = overIndex === -1 ? destinoItems.length : overIndex;

      const next = new Map(prev);
      next.set(origenKey, [...origenItems.slice(0, activeIndex), ...origenItems.slice(activeIndex + 1)]);
      next.set(destinoKey, [
        ...destinoItems.slice(0, insertarEn),
        origenItems[activeIndex],
        ...destinoItems.slice(insertarEn),
      ]);
      return next;
    });
  };

  const handleDragCancel = () => {
    if (dragSnapshotRef.current) setLocalOps(dragSnapshotRef.current);
    dragSnapshotRef.current = null;
    setActiveCard(null);
    setActiveOriginStageId(null);
  };

  const handleDragEnd = ({ over }: DragEndEvent) => {
    const origen = activeOriginStageId;
    const oportunidad = activeCard;
    const snapshot = dragSnapshotRef.current;
    setActiveCard(null);
    setActiveOriginStageId(null);
    dragSnapshotRef.current = null;

    if (!puedeMod || !oportunidad || !origen) return;

    // Zonas rápidas Ganado/Perdido — handleDragOver las ignora a propósito,
    // así que acá sí hay que mover la tarjeta a mano (no vive en ninguna
    // columna real del tablero mientras se sobrevuela la zona).
    if (over && (over.id === ZONA_GANADO_ID || over.id === ZONA_PERDIDO_ID)) {
      const nuevoStageId = over.id === ZONA_GANADO_ID ? stageGanado?.id : stagePerdido?.id;
      if (!nuevoStageId || nuevoStageId === origen) { if (snapshot) setLocalOps(snapshot); return; }
      const nuevoStage = pipeline.stages.find((s) => s.id === nuevoStageId);
      setLocalOps((prev) => {
        const next = new Map(prev);
        next.set(origen, (next.get(origen) ?? []).filter((o) => o.id !== oportunidad.id));
        next.set(nuevoStageId, [
          { ...oportunidad, stageId: nuevoStageId, pipelineId: pipeline.id, probabilidad: nuevoStage?.probabilidad ?? oportunidad.probabilidad },
          ...(next.get(nuevoStageId) ?? []),
        ]);
        return next;
      });
      confirmarMovimiento(oportunidad, origen, nuevoStageId);
      return;
    }

    if (!over) { if (snapshot) setLocalOps(snapshot); return; }

    // Ruta normal: handleDragOver ya fue moviendo la tarjeta en vivo — solo
    // falta ver en qué columna terminó y, si cambió de etapa, confirmarlo.
    const destino = encontrarStageDe(oportunidad.id, localOps);
    if (!destino || destino === origen) return;

    const nuevoStage = pipeline.stages.find((s) => s.id === destino);
    setLocalOps((prev) => {
      const items = prev.get(destino);
      if (!items) return prev;
      const idx = items.findIndex((o) => o.id === oportunidad.id);
      if (idx === -1) return prev;
      const next = new Map(prev);
      const actualizados = [...items];
      actualizados[idx] = {
        ...actualizados[idx],
        stageId: destino,
        pipelineId: pipeline.id,
        probabilidad: nuevoStage?.probabilidad ?? actualizados[idx].probabilidad,
      };
      next.set(destino, actualizados);
      return next;
    });
    confirmarMovimiento(oportunidad, origen, destino);
  };

  // Aplica el total/conteo optimista de mover `oportunidad` de `origen` a
  // `destino` y confirma el cambio de etapa contra el servidor. El
  // reacomodo visual (a qué columna/posición fue a parar) ya quedó resuelto
  // antes de llamar a esto — ver handleDragOver y handleDragEnd.
  const confirmarMovimiento = (oportunidad: OportunidadEnStage, origen: string, destino: string) => {
    setLocalTotales((prev) => {
      const next = new Map(prev);
      next.set(origen, (next.get(origen) ?? 0) - oportunidad.valor);
      next.set(destino, (next.get(destino) ?? 0) + oportunidad.valor);
      return next;
    });

    setLocalConteos((prev) => {
      const next = new Map(prev);
      next.set(origen, Math.max(0, (next.get(origen) ?? 0) - 1));
      next.set(destino, (next.get(destino) ?? 0) + 1);
      return next;
    });

    moverMutation.mutate(
      { oportunidadId: oportunidad.id, nuevoStageId: destino, pipelineId: pipeline.id },
      {
        onError: (err) => {
          toast.error(err.message ?? "Error al mover la oportunidad");
          setLocalOps(oportunidadesPorStage);
          setLocalTotales(totalesPorStage);
          setLocalConteos(conteoPorStage);
        },
        onSuccess: () => {
          const stage = pipeline.stages.find((s) => s.id === destino);
          toast.success(`Movido a "${stage?.nombre ?? destino}"`);
        },
      },
    );
  };

  const handleUpdate = (updated: Oportunidad & { stageId?: string | null }) => {
    if (updated.stageId === undefined) return;
    let stageAnterior: string | null = null;
    let valorAnterior = 0;
    setLocalOps((prev) => {
      const next = new Map(prev);
      let tagsExistentes: OportunidadEnStage["tags"] = [];
      let contactoExistente: OportunidadEnStage["contacto"] = null;
      let estadoCotizacionExistente: OportunidadEnStage["estadoCotizacion"] = null;
      for (const [key, ops] of next) {
        const found = ops.find((o) => o.id === updated.id);
        if (found) {
          tagsExistentes = found.tags;
          contactoExistente = found.contacto;
          estadoCotizacionExistente = found.estadoCotizacion;
          stageAnterior = key;
          valorAnterior = found.valor;
          break;
        }
      }
      for (const [key, ops] of next) {
        next.set(key, ops.filter((o) => o.id !== updated.id));
      }
      const targetStage = updated.stageId ?? "__sin_stage__";
      next.set(targetStage, [
        {
          id: updated.id,
          titulo: updated.titulo,
          valor: updated.valor,
          moneda: updated.moneda,
          probabilidad: updated.probabilidad ?? 0,
          fechaCierre: updated.fechaCierre,
          stageId: updated.stageId ?? null,
          pipelineId: updated.pipelineId ?? pipeline.id,
          nuevoMensaje: false,
          empresa: updated.empresa,
          contacto: updated.contactos?.[0]?.contacto ?? contactoExistente,
          tags: updated.tags ?? tagsExistentes,
          // Oportunidad no trae info de cotizaciones — se conserva la que ya
          // tenía la tarjeta (esto no cambia al mover de etapa ni al editar
          // campos de la oportunidad, solo al crear/aprobar una cotización).
          estadoCotizacion: estadoCotizacionExistente,
        },
        ...(next.get(targetStage) ?? []),
      ]);
      return next;
    });

    setLocalTotales((prev) => {
      const next = new Map(prev);
      const targetStage = updated.stageId ?? "__sin_stage__";
      if (stageAnterior) {
        next.set(stageAnterior, (next.get(stageAnterior) ?? 0) - valorAnterior);
      }
      next.set(targetStage, (next.get(targetStage) ?? 0) + updated.valor);
      return next;
    });

    // Solo cambia el conteo si de verdad cambió de etapa — si es la misma,
    // el "-1 luego +1" de abajo daría lo mismo, pero mejor no tocarlo.
    if (stageAnterior !== (updated.stageId ?? "__sin_stage__")) {
      setLocalConteos((prev) => {
        const next = new Map(prev);
        const targetStage = updated.stageId ?? "__sin_stage__";
        if (stageAnterior) {
          next.set(stageAnterior, Math.max(0, (next.get(stageAnterior) ?? 0) - 1));
        }
        next.set(targetStage, (next.get(targetStage) ?? 0) + 1);
        return next;
      });
    }
  };

  const handleDelete = (id: string) => {
    let stageEliminado: string | null = null;
    let valorEliminado = 0;
    setLocalOps((prev) => {
      const next = new Map(prev);
      for (const [key, ops] of next) {
        const found = ops.find((o) => o.id === id);
        if (found) { stageEliminado = key; valorEliminado = found.valor; }
        next.set(key, ops.filter((o) => o.id !== id));
      }
      return next;
    });
    if (stageEliminado) {
      setLocalTotales((prev) => {
        const next = new Map(prev);
        next.set(stageEliminado!, (next.get(stageEliminado!) ?? 0) - valorEliminado);
        return next;
      });
      setLocalConteos((prev) => {
        const next = new Map(prev);
        next.set(stageEliminado!, Math.max(0, (next.get(stageEliminado!) ?? 0) - 1));
        return next;
      });
    }
    setSelected(null);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <KanbanScrollContainer
          stageColors={stagesColumnas.map((s) => s.color ?? "#818cf8")}
        >
          {stagesColumnas.map((stage) => {
            const items = localOps.get(stage.id) ?? [];
            return (
              <ColumnaStage
                key={stage.id}
                stage={stage}
                pipelineId={pipeline.id}
                items={items}
                total={localTotales.get(stage.id) ?? 0}
                conteo={Math.max(localConteos.get(stage.id) ?? 0, items.length)}
                onCardClick={(op) => setSelected({ id: op.id, stageId: op.stageId ?? null })}
                puedeMod={puedeMod}
                resaltada={!!activeCard && items.some((o) => o.id === activeCard.id)}
              />
            );
          })}
        </KanbanScrollContainer>

        {/* Centinela para "cargar más" — invisible, solo mientras falten
            oportunidades por traer en alguna etapa. Vive fuera de
            KanbanScrollContainer para no interferir con el scroll horizontal. */}
        {hayMasPorCargar && <div ref={sentinelRef} aria-hidden className="h-px" />}

        {cargandoMas && (
          <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-stone-400 dark:text-white/30">
            <Loader2 className="h-3 w-3 animate-spin" />
            Cargando más oportunidades…
          </div>
        )}

        {/* Zonas rápidas Ganado/Perdido — siempre presentes al pie del
            tablero (discretas en reposo), para soltar directo sin buscar la
            columna correspondiente (útil si está lejos o escondida por "Ver
            ocultos"). Fuera de KanbanScrollContainer a propósito: no viajan
            con el scroll horizontal, quedan fijas debajo de las columnas. */}
        {puedeMod && (stageGanado || stagePerdido) && (
          <ZonasResultadoRapido stageGanado={stageGanado} stagePerdido={stagePerdido} dragging={!!activeCard} />
        )}

        <DragOverlay dropAnimation={{ duration: 150 }}>
          {activeCard && <TarjetaOverlay oportunidad={activeCard} />}
        </DragOverlay>
      </DndContext>

      <WorkspaceOportunidad
        oportunidadId={selected?.id ?? null}
        initialStageId={selected?.stageId ?? null}
        pipeline={pipeline}
        empresas={empresas}
        contactos={contactos}
        defaultCountryCode={defaultCountryCode}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  );
}
