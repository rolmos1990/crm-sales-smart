"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  pointerWithin,
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
import {
  CalendarDays, Building2, Plus, User, Receipt, Trophy, XCircle, Loader2, FileText, FileCheck2,
  MoreVertical, ArrowRightLeft, Pencil,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMoverAStageMutation } from "@/crm/oportunidades/hooks";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { PipelineConStages, PipelineStage, OportunidadEnStage } from "../types";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import { WorkspaceOportunidad } from "@/crm/oportunidades/components/workspace-oportunidad";
import type { Oportunidad } from "@/crm/oportunidades/types";
import { KanbanScrollContainer } from "./kanban-scroll-container";

/** Por debajo de este ancho, el tablero pasa de columnas Kanban a una sola
 *  etapa con tabs horizontales (ver PipelineKanbanDinamico). 768px, no el
 *  1024px del drawer del sidebar — son adaptaciones independientes con
 *  criterios propios. */
const MOBILE_BREAKPOINT_QUERY = "(max-width: 767px)";

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
          ? "bg-success-muted border-success-border text-success-text"
          : "bg-muted border-border text-muted-foreground"
      )}
    >
      {aprobada ? <FileCheck2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
    </span>
  );
}

// ── Tarjeta — contenido puro ──────────────────────────────────────
// Sin dnd-kit ni wrapper: la misma UI para la tarjeta Kanban (arrastrable,
// ver TarjetaOportunidad) y la tarjeta móvil (sin drag, ver
// TarjetaOportunidadMovil) — evita duplicar el markup completo entre las
// dos variantes (ver docs/pipeline responsive), a costa de un `variant` que
// solo ajusta detalles menores (máx. 2 etiquetas + "+N" en móvil, tarjetas
// más "aireadas" en vez del compacto de columna).
function ContenidoTarjetaOportunidad({
  oportunidad,
  stageColor,
  variant = "kanban",
}: {
  oportunidad: OportunidadEnStage;
  stageColor: string;
  variant?: "kanban" | "mobile";
}) {
  const esMovil = variant === "mobile";
  const tagsVisibles = esMovil ? oportunidad.tags.slice(0, 2) : oportunidad.tags;
  const tagsDeMas = esMovil ? oportunidad.tags.length - tagsVisibles.length : 0;

  return (
    <div
      className={cn(
        "rounded-xl border select-none",
        "bg-card",
        "shadow-sm dark:shadow-[0_2px_10px_-6px_rgba(0,0,0,0.55)]",
        esMovil ? "p-4 space-y-3" : "p-3.5 space-y-3"
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
        {/* En móvil se reserva espacio a la derecha (pr-8) para el botón ⋮
            flotante de TarjetaOportunidadMovil — sin esto la insignia de
            cotización quedaría debajo del botón cuando ambos están presentes. */}
        <div className={cn("flex items-start justify-between gap-2", esMovil && "pr-8")}>
          <p className={cn("font-semibold leading-snug line-clamp-2 text-foreground", esMovil ? "text-[15px]" : "text-[14px]")}>
            {oportunidad.titulo}
          </p>
          <InsigniaCotizacion estado={oportunidad.estadoCotizacion} />
        </div>
        {(oportunidad.contacto || oportunidad.empresa) && (
          <div className="space-y-0.5">
            {oportunidad.contacto && (
              <div className="flex items-center gap-1.5 min-w-0">
                <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-[12.5px] text-muted-foreground truncate">
                  {oportunidad.contacto.nombre} {oportunidad.contacto.apellido}
                </span>
              </div>
            )}
            {oportunidad.empresa && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-[12.5px] text-muted-foreground truncate">
                  {oportunidad.empresa.nombre}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Separador sutil entre identidad e información comercial */}
      <div className="border-t border-card-divider" />

      {/* Monto (izquierda) + vencimiento (derecha, cápsula neutral) */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold tabular-nums text-foreground">
          {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
        </span>
        {oportunidad.fechaCierre && (
          <span className="inline-flex items-center gap-1 rounded-md border border-badge-border bg-badge-bg px-1.5 py-0.5 text-[10.5px] font-medium text-badge-text shrink-0">
            <CalendarDays className="h-3 w-3 shrink-0" />
            Vence {format(new Date(oportunidad.fechaCierre), "dd MMM", { locale: es })}
          </span>
        )}
      </div>

      {/* Etiquetas — Kanban sin límite; móvil máx. 2 + "+N" (ver esMovil arriba) */}
      {oportunidad.tags && oportunidad.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tagsVisibles.map(({ tagId, tag }) => (
            <span
              key={tagId}
              className="inline-flex items-center gap-1.5 rounded-full border border-badge-border bg-badge-bg px-2 py-0.5 text-[10px] font-medium text-badge-text"
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: tag.color ?? "#78716c", opacity: 0.75 }}
              />
              {tag.nombre}
            </span>
          ))}
          {tagsDeMas > 0 && (
            <span className="inline-flex items-center rounded-full border border-badge-border bg-badge-bg px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              +{tagsDeMas}
            </span>
          )}
        </div>
      )}

      {/* Progreso — relleno del color de etapa desaturado, sin resplandor */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1 bg-muted rounded-full h-1 overflow-hidden">
          <div
            className="rounded-full h-1 transition-all"
            style={{ width: `${oportunidad.probabilidad}%`, backgroundColor: stageColor, opacity: 0.55 }}
          />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground tabular-nums w-7 text-right">
          {oportunidad.probabilidad}%
        </span>
        {oportunidad.nuevoMensaje && (
          <span className="h-1.5 w-1.5 rounded-full bg-success/80 shrink-0" />
        )}
      </div>
    </div>
  );
}

// ── Tarjeta draggable (Kanban de escritorio) ───────────────────────

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
          "cursor-pointer transition-all duration-150 hover:shadow-sm dark:hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.7)]",
          // Se está arrastrando: transparencia (queda leyéndose como el
          // "hueco" que marca dónde va a caer) + borde resaltado — mismo
          // tamaño y forma de siempre, nada de escalar ni rotar acá (eso lo
          // hace la copia flotante de <TarjetaOverlay>, ver DragOverlay).
          isDragging && "opacity-40 shadow-none ring-2 ring-primary/70 dark:ring-primary/50"
        )}
      >
        <ContenidoTarjetaOportunidad oportunidad={oportunidad} stageColor={stageColor} variant="kanban" />
      </div>
    </div>
  );
}

// ── Tarjeta móvil (sin dnd-kit) ─────────────────────────────────────
// Misma tarjeta (ver ContenidoTarjetaOportunidad) sin useSortable/DndContext
// — en móvil el movimiento entre etapas se hace por el menú ⋮, no
// arrastrando (ver Objetivo del pedido: no es obligatorio montar el
// contexto de drag & drop completo en móvil).

function TarjetaOportunidadMovil({
  oportunidad,
  stageColor,
  stagesDestino,
  onCardClick,
  onMover,
  stageGanadoId,
  stagePerdidoId,
  puedeMod = true,
}: {
  oportunidad: OportunidadEnStage;
  stageColor: string;
  /** Etapas del tablero a las que se puede mover (la actual queda afuera). */
  stagesDestino: PipelineStage[];
  onCardClick: (op: OportunidadEnStage) => void;
  onMover: (op: OportunidadEnStage, destinoStageId: string) => void;
  stageGanadoId?: string;
  stagePerdidoId?: string;
  puedeMod?: boolean;
}) {
  const [moverAbierto, setMoverAbierto] = useState(false);

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onCardClick(oportunidad)}
        onKeyDown={(e) => { if (e.key === "Enter") onCardClick(oportunidad); }}
        className="cursor-pointer"
      >
        <ContenidoTarjetaOportunidad oportunidad={oportunidad} stageColor={stageColor} variant="mobile" />
      </div>

      {puedeMod && (
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            aria-label="Más acciones"
            className="absolute top-3 right-3.5 flex h-11 w-11 -m-2.5 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none"
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => onCardClick(oportunidad)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </DropdownMenuItem>
            {stagesDestino.length > 0 && (
              <DropdownMenuItem onClick={() => setMoverAbierto(true)}>
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Mover a etapa…
              </DropdownMenuItem>
            )}
            {(stageGanadoId || stagePerdidoId) && <DropdownMenuSeparator />}
            {stageGanadoId && (
              <DropdownMenuItem onClick={() => onMover(oportunidad, stageGanadoId)} className="text-success focus:text-success">
                <Trophy className="h-3.5 w-3.5" />
                Marcar como ganado
              </DropdownMenuItem>
            )}
            {stagePerdidoId && (
              <DropdownMenuItem onClick={() => onMover(oportunidad, stagePerdidoId)} className="text-danger focus:text-danger">
                <XCircle className="h-3.5 w-3.5" />
                Marcar como perdido
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* "Selector ligero" pedido para mover de etapa — bottom sheet (mismo
          primitivo Sheet que ya usa el resto de la app, side="bottom"), no
          un componente nuevo. Reutiliza el mismo onMover→confirmarMovimiento
          que ya usan el drag & drop y "Marcar como ganado/perdido". */}
      <Sheet open={moverAbierto} onOpenChange={setMoverAbierto}>
        <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl border-border bg-modal">
          <SheetHeader>
            <SheetTitle>Mover a etapa</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4 space-y-1">
            {stagesDestino.map((stage) => (
              <button
                key={stage.id}
                onClick={() => { onMover(oportunidad, stage.id); setMoverAbierto(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 min-h-11 text-left text-[14px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color ?? "#818cf8" }} />
                {stage.nombre}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TarjetaOverlay({ oportunidad }: { oportunidad: OportunidadEnStage }) {
  return (
    // Sin rotación — solo un scale leve (reducción) + opacidad, para que se
    // lea como "levantada del tablero" sin verse deformada. El transform acá
    // es puramente cosmético (escala): el posicionamiento real sobre el
    // cursor lo maneja el propio DragOverlay de dnd-kit por fuera de este nodo.
    <div className="w-[272px] scale-[0.97] opacity-95 rounded-xl border border-card-border bg-card shadow-[0_16px_32px_-10px_rgba(0,0,0,0.5)] p-3.5 space-y-2">
      <p className="text-[14px] font-semibold line-clamp-1 text-foreground">
        {oportunidad.titulo}
      </p>
      <p className="text-[15px] font-semibold text-foreground tabular-nums">
        {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
      </p>
      {oportunidad.contacto && (
        <p className="text-[12px] text-muted-foreground">
          {oportunidad.contacto.nombre} {oportunidad.contacto.apellido}
        </p>
      )}
      {oportunidad.empresa && (
        <p className="text-[12px] text-muted-foreground">{oportunidad.empresa.nombre}</p>
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
  scrolled = false,
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
  /** El contenedor de scroll único del Pipeline (data-pipeline-vscroll, ver
   *  pipeline-wrapper.tsx) ya se movió de su posición inicial — solo se usa
   *  para sumarle una sombra muy leve al header sticky, así en reposo (tope
   *  del scroll) no queda flotando sobre nada. */
  scrolled?: boolean;
}) {
  const { setNodeRef, isOver: isOverContenedor } = useDroppable({ id: stage.id });
  const isOver = isOverContenedor || resaltada;
  const color = stage.color ?? "#818cf8";

  return (
    // Sin h-full acá a propósito: este div ES el flex item directo de la fila
    // de columnas (data-kanban-scroll, ver KanbanScrollContainer) — su altura
    // tiene que quedar en el valor por defecto (auto) para que participe del
    // `align-items: stretch` de esa fila. Un `height: 100%` explícito, aunque
    // el padre no tenga una altura definida, ya cuenta como "no auto" para el
    // algoritmo de stretch y lo desactiva — por eso antes cada columna
    // terminaba con la altura de su propio contenido en vez de la de la más
    // alta. Una vez estirado por la fila, este div SÍ tiene una altura
    // definida, así que el h-full de acá abajo (su hijo directo) vuelve a
    // resolver con normalidad — y con eso, una etapa con pocas oportunidades
    // sigue siendo un blanco de suelta grande, no solo el recuadro chico
    // alrededor de sus 2-3 tarjetas.
    <div className="flex-shrink-0 w-[272px]" data-testid="pipeline-column">
      <div
        className={cn(
          "flex h-full flex-col rounded-xl border transition-all duration-150",
          "bg-column-bg",
          "border-column-border",
          // Hover del drag: además del anillo, un tinte leve de fondo en el
          // color de la propia etapa — "se ilumina" sin gritar.
          isOver && "ring-1 dark:ring-offset-background"
        )}
        style={isOver ? { "--tw-ring-color": `${color}30`, backgroundColor: `${color}08` } as React.CSSProperties : undefined}
      >
        {/* Header sticky: línea de color + nombre/contador/botón + total. Se
            ancla al único contenedor de scroll del Pipeline
            (data-pipeline-vscroll, ver pipeline-wrapper.tsx) y queda visible
            arriba mientras se hace scroll vertical, sin scroll propio de la
            columna. Fondo casi sólido + blur muy sutil para que las tarjetas
            no se transparenten al pasar por debajo; el `overflow-hidden` que
            antes vivía en el wrapper de arriba se quitó (rompía el sticky),
            así que acá se repite `rounded-t-xl` a mano para que la línea de
            color no sobresalga de las esquinas redondeadas de la columna. */}
        <div
          className={cn(
            "sticky top-0 z-10 rounded-t-xl backdrop-blur-sm transition-shadow duration-150",
            "bg-column-header-bg/95",
            "border-b border-column-border/70",
            // Sombra muy ligera — solo aparece una vez que el usuario empezó a
            // scrollear, para no sumar ruido visual con el tablero en reposo.
            scrolled && "shadow-[0_4px_10px_-6px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_10px_-6px_rgba(0,0,0,0.45)]"
          )}
          style={isOver ? { backgroundColor: `${color}14` } as React.CSSProperties : undefined}
        >
          <div className="h-[2px] opacity-70" style={{ backgroundColor: color }} />

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
                  className="inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 rounded bg-badge-bg text-[10px] font-bold text-badge-text"
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
                    className="h-5 w-5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </Link>
              )}
            </div>

            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" data-testid="column-total">
              <Receipt className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">Total</span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatearMoneda(total, "PEN")}
              </span>
            </div>
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
                isOver ? "font-medium" : "border-border text-muted-foreground"
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
        !dragging && "border-border bg-muted/40",
        // Hay un drag en curso (en cualquier parte del tablero) — un poco más
        // de presencia y el color empieza a insinuarse, sin gritar todavía.
        dragging && !isOver && esGanado && "border-success/40 bg-success-muted/60",
        dragging && !isOver && !esGanado && "border-danger/40 bg-danger-muted/60",
        // La tarjeta está justo encima de esta zona — feedback inmediato y claro.
        isOver && esGanado && "border-solid border-success bg-success-muted scale-[1.01]",
        isOver && !esGanado && "border-solid border-danger bg-danger-muted scale-[1.01]"
      )}
    >
      <Icono
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-colors",
          !dragging
            ? "text-muted-foreground"
            : esGanado ? "text-success" : "text-danger"
        )}
      />
      <p
        className={cn(
          "text-[12px] font-semibold transition-colors",
          !dragging
            ? "text-muted-foreground"
            : esGanado ? "text-success-text" : "text-danger-text"
        )}
      >
        {stage.nombre}
      </p>
      <p className="text-[11px] text-muted-foreground">
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
    <div
      className={cn(
        // sticky left-0: el scroll horizontal ahora vive en el mismo
        // contenedor que envuelve a todo el tablero (data-pipeline-vscroll,
        // ver pipeline-wrapper.tsx) — sin esto, las zonas se irían de vista
        // al desplazar el tablero hacia columnas más a la derecha. Al no
        // vivir dentro de la fila ancha de columnas, su ancho ya se
        // resuelve solo contra el contenedor (viewport visible), así que
        // alcanza con anclar el borde izquierdo.
        "sticky left-0 mt-4 flex gap-3",
        // Mientras se arrastra una oportunidad, ancla TAMBIÉN el borde
        // inferior a data-pipeline-vscroll — mismo nodo, mismos ids de
        // droppable, mismo handler (ver handleDragEnd): no es una copia, es
        // este mismo footer que el navegador despega solo cuando su
        // posición natural saldría del viewport. Si ya está visible (el
        // usuario llegó al final del tablero), `sticky` no lo mueve — por
        // construcción nunca puede haber una copia duplicada en pantalla.
        // El pb-6 del contenedor de scroll ya deja colchón de sobra para
        // que esto no quede recortado por el crop del scrollbar horizontal
        // (ver pipeline-wrapper.tsx). Fuera de un drag, cero cambios.
        dragging && "bottom-0 z-20"
      )}
    >
      {stageGanado && <ZonaSoltarResultado stage={stageGanado} tipo="ganado" dragging={dragging} />}
      {stagePerdido && <ZonaSoltarResultado stage={stagePerdido} tipo="perdido" dragging={dragging} />}
    </div>
  );
}

// ── Tabs de etapas (móvil) ──────────────────────────────────────────
// role="tablist" real — cada tab controla el panel de la etapa
// seleccionada (aria-controls, ver el id del panel más abajo en el
// render móvil de PipelineKanbanDinamico).

function TabsEtapasMovil({
  stages,
  conteos,
  selectedStageId,
  onSelect,
}: {
  stages: PipelineStage[];
  conteos: Map<string, number>;
  selectedStageId: string | null;
  onSelect: (id: string) => void;
}) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!selectedStageId) return;
    tabRefs.current.get(selectedStageId)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selectedStageId]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = stages.findIndex((s) => s.id === selectedStageId);
    if (idx === -1) return;
    let siguiente: PipelineStage | undefined;
    if (e.key === "ArrowRight") siguiente = stages[idx + 1];
    else if (e.key === "ArrowLeft") siguiente = stages[idx - 1];
    if (!siguiente) return;
    e.preventDefault();
    onSelect(siguiente.id);
    tabRefs.current.get(siguiente.id)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Etapas del pipeline"
      onKeyDown={onKeyDown}
      className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 -mx-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      style={{ scrollSnapType: "x proximity" }}
    >
      {stages.map((stage) => {
        const activo = stage.id === selectedStageId;
        const color = stage.color ?? "#818cf8";
        return (
          <button
            key={stage.id}
            ref={(el) => { if (el) tabRefs.current.set(stage.id, el); else tabRefs.current.delete(stage.id); }}
            role="tab"
            id={`pipeline-tab-${stage.id}`}
            aria-selected={activo}
            aria-controls={`pipeline-panel-${stage.id}`}
            tabIndex={activo ? 0 : -1}
            onClick={() => onSelect(stage.id)}
            style={{
              scrollSnapAlign: "center",
              ...(activo ? { borderColor: `${color}55`, backgroundColor: `${color}12`, color } : undefined),
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 min-h-11 text-[13px] font-medium transition-colors",
              !activo && "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span>{stage.nombre}</span>
            <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded bg-badge-bg text-[10px] font-bold text-badge-text">
              {conteos.get(stage.id) ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Resumen de la etapa activa (móvil) ──────────────────────────────

function ResumenEtapaMovil({
  stage,
  conteo,
  total,
  pipelineId,
  puedeMod,
}: {
  stage: PipelineStage;
  conteo: number;
  total: number;
  pipelineId: string;
  puedeMod: boolean;
}) {
  const color = stage.color ?? "#818cf8";
  return (
    <div className="rounded-xl border border-column-border bg-column-bg overflow-hidden shrink-0">
      <div className="h-[2px] opacity-70" style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between px-3.5 pt-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-semibold truncate"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {stage.nombre}
          </span>
          <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded bg-badge-bg text-[10px] font-bold text-badge-text">
            {conteo}
          </span>
        </div>
        {puedeMod && (
          <Link href={`/crm/oportunidades/nueva?pipelineId=${pipelineId}&stageId=${stage.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-3.5 pt-1 pb-2.5 text-[11px]">
        <Receipt className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground font-medium">Total</span>
        <span className="font-semibold tabular-nums text-foreground">{formatearMoneda(total, "PEN")}</span>
      </div>
    </div>
  );
}

// ── FAB "Nueva oportunidad" (móvil) ──────────────────────────────────
// Fixed a la ventana, no al contenedor de scroll del tablero — mismo
// destino que ya usa el botón "Nueva oportunidad" de escritorio
// (pipeline-wrapper.tsx), solo reposicionado/restilado para móvil.
// bottom: 88px deja lugar debajo para un segundo FAB (ej. el de IA, si la
// página lo agrega) sin superponerse — ver pedido original.

function FabNuevaOportunidad({ pipelineId, stageId }: { pipelineId: string; stageId: string | null }) {
  if (!stageId) return null;
  return (
    <Link
      href={`/crm/oportunidades/nueva?pipelineId=${pipelineId}&stageId=${stageId}`}
      aria-label="Nueva oportunidad"
      style={{
        position: "fixed",
        right: "16px",
        bottom: "calc(88px + env(safe-area-inset-bottom))",
        zIndex: 30,
      }}
      className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-6px_color-mix(in_oklab,var(--primary)_55%,transparent)] hover:bg-primary-hover active:scale-95 transition-all"
    >
      <Plus className="h-6 w-6" />
    </Link>
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
  // Alimenta la sombra (muy leve) del header sticky de cada columna — solo
  // debe aparecer una vez que el tablero se movió de su posición inicial,
  // nunca en reposo. Se lee del contenedor de scroll único del Pipeline
  // (data-pipeline-vscroll, ver pipeline-wrapper.tsx), no de un ref propio,
  // porque ese contenedor vive un nivel por encima de este componente.
  const [scrolled, setScrolled] = useState(false);
  // Foto de `localOps` justo antes de empezar a arrastrar — si el drag se
  // cancela o se suelta fuera de cualquier destino válido, se vuelve a esto
  // en vez de dejar el tablero a mitad de un reordenamiento en vivo.
  const dragSnapshotRef = useRef<Map<string, OportunidadEnStage[]> | null>(null);
  // Espejo de `activeCard` siempre al día, para leerlo desde el listener
  // "red de seguridad" de más abajo sin que le importe si su cierre quedó
  // desactualizado (ver ese useEffect).
  const activeCardRef = useRef<OportunidadEnStage | null>(null);
  const moverMutation = useMoverAStageMutation();

  // Vista móvil (una sola etapa + tabs) vs. Kanban de escritorio. `montado`
  // evita montar el DndContext completo (todas las columnas, sensores de
  // puntero) durante el primer render en un celular real: sin esto, SSR e
  // hidratación siempre devuelven `esMobile=false` (ver useMediaQuery) y el
  // Kanban de escritorio completo llegaría a montarse un instante antes de
  // corregirse — acá se espera al primer efecto (mismo momento en que
  // useMediaQuery ya tiene el valor real) para elegir el árbol correcto
  // directamente, sin ese parpadeo/doble montaje.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const esMobile = useMediaQuery(MOBILE_BREAKPOINT_QUERY);

  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

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

  useEffect(() => {
    activeCardRef.current = activeCard;
  }, [activeCard]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-pipeline-vscroll]");
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 4);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Las etapas Ganado/Perdido con visible=false no se muestran como columna,
  // pero la oportunidad se sigue pudiendo mover ahí (drag a otra vía o popover
  // "Mover a") — "Ver ocultos" las trae de vuelta al tablero sin tocar la
  // configuración del pipeline.
  const stagesColumnas = verOcultos
    ? pipeline.stages
    : pipeline.stages.filter((s) => !(s.esGanado || s.esPerdido) || s.visible);

  // Etapa activa de la vista móvil: conserva la selección si sigue siendo
  // válida (ver Objetivo del pedido — "conservar la etapa seleccionada si
  // ya existe en estado"); si no hay ninguna todavía o la que había dejó de
  // existir en `stagesColumnas` (ej. se apagó "Ver ocultos"), cae a la
  // primera etapa visible. No depende de la URL a propósito: cambiar de tab
  // no debe navegar ni disparar un refetch del Server Component.
  useEffect(() => {
    setSelectedStageId((actual) =>
      actual && stagesColumnas.some((s) => s.id === actual) ? actual : (stagesColumnas[0]?.id ?? null)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagesColumnas]);

  // Etapas destino de las zonas rápidas "Ganado"/"Perdido" que aparecen al
  // arrastrar — si el pipeline tiene más de una marcada, se usa la primera.
  const stageGanado = pipeline.stages.find((s) => s.esGanado);
  const stagePerdido = pipeline.stages.find((s) => s.esPerdido);

  // Ids de TODAS las etapas del pipeline — fuente de verdad para "¿esto es
  // una columna completa?" en el drag & drop (ver encontrarStageDe y
  // handleDragOver). No alcanza con `localOps.has(id)`: el mapa que manda el
  // servidor solo trae una key por etapa que ya tenga alguna oportunidad
  // cargada, así que una etapa completamente vacía (0 oportunidades) nunca
  // aparece como key ahí — soltar una tarjeta en su espacio vacío se
  // reconocía como "no es contenedor válido" y el movimiento se perdía en
  // silencio.
  const stageIds = useMemo(() => new Set(pipeline.stages.map((s) => s.id)), [pipeline.stages]);

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

  // closestCorners (por distancia entre esquinas) puede "perder" el
  // contenedor grande de una etapa corta cuando el cursor está en el
  // espacio vacío debajo de sus pocas tarjetas, sobre todo si al lado hay
  // una etapa larga cuyas tarjetas quedan geométricamente más cerca. acá se
  // resuelve por contención real del cursor (pointerWithin) — toda la
  // superficie de la columna (setNodeRef en ColumnaStage, ver más abajo, ya
  // ocupa el alto completo estirado) cuenta como destino válido, no solo el
  // bloque de tarjetas cargadas. Si el cursor está encima de una tarjeta
  // puntual (no solo del contenedor que la envuelve — pointerWithin
  // devuelve ambas, la tarjeta está anidada dentro del contenedor), se
  // prioriza la tarjeta para no perder precisión al reordenar/insertar
  // entre tarjetas. Sin match de pointerWithin (ej. en el gap entre
  // columnas), se cae al comportamiento de siempre.
  const detectarColision: CollisionDetection = useCallback(
    (args) => {
      const enElPuntero = pointerWithin(args);
      if (enElPuntero.length === 0) return closestCorners(args);
      const sobreTarjeta = enElPuntero.find((c) =>
        [...localOps.values()].some((items) => items.some((o) => o.id === c.id))
      );
      return sobreTarjeta ? [sobreTarjeta] : enElPuntero;
    },
    [localOps]
  );

  // Encuentra en qué columna vive ahora mismo un id — puede ser el id de una
  // etapa (se soltó sobre el contenedor: columna vacía, o el hueco debajo de
  // la última tarjeta) o el id de otra tarjeta (se soltó sobre/entre otras).
  // Se compara contra `stageIds` (todas las etapas reales), no contra las
  // keys de `ops` — una etapa sin ninguna oportunidad cargada no tiene key
  // en ese mapa, así que `ops.has(id)` la daba por inválida.
  const encontrarStageDe = (id: string, ops: Map<string, OportunidadEnStage[]>): string | null => {
    if (stageIds.has(id)) return id;
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
      // stageIds, no prev.has(overId): una etapa vacía no tiene key en
      // `prev` (ver comentario en la declaración de stageIds) — sin esto,
      // soltar una tarjeta en el espacio vacío de una etapa recién vaciada
      // o que nunca tuvo oportunidades no se reconocía como destino válido.
      const destinoEsContenedor = stageIds.has(overId);
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

  // Red de seguridad contra un drag que se queda "congelado" (la tarjeta se
  // queda con el anillo de "arrastrando" para siempre y el DragOverlay
  // flotando sin poder soltarse — no se puede volver a mover nada hasta
  // recargar). Dos causas reales, ambas con la misma cura:
  //
  // 1) @dnd-kit/core (AbstractPointerSensor.attach, ver
  //    getEventListenerTarget) ata sus listeners de pointermove/pointerup
  //    directo al NODO DOM de la tarjeta que arrancó el drag, no a
  //    document — a propósito, para que sigan funcionando aunque el nodo se
  //    mueva de posición. Pero acá una tarjeta puede cruzar de una columna
  //    a otra EN VIVO mientras se arrastra (handleDragOver, más arriba) —
  //    cada columna tiene su propio SortableContext, así que cruzar de
  //    columna hace que React desmonte ese nodo en la columna de origen y
  //    monte uno nuevo en la de destino. El listener original queda
  //    huérfano: nunca vuelve a recibir el pointerup, con la ventana
  //    todavía en foco y sin que el usuario haya hecho nada raro.
  // 2) La ventana pierde el foco a mitad de un arrastre (alt-tab, clic
  //    fuera, una notificación del sistema) — dnd-kit ya cancela solo en
  //    `resize`/`visibilitychange`, pero no en `blur` puro.
  //
  // La cura correcta es reusar el propio mecanismo de cancelación de
  // dnd-kit en vez de limpiar solo nuestro estado por un lado: su
  // PointerSensor escucha `keydown` con `code === "Escape"` sobre
  // `document` (ese sí, siempre vivo, no atado al nodo de la tarjeta) —
  // simular esa tecla dispara su handleCancel real, que resetea su
  // isDragging Y termina llamando a nuestro onDragCancel por su cuenta.
  // handleDragCancel se llama también acá como respaldo (usa solo
  // refs/setters estables, así que un cierre "viejo" es seguro), por si el
  // simulacro de tecla no alcanzara a este sensor por algún motivo. El
  // pointerup/pointercancel a nivel window sí ocurre con normalidad en
  // ambos casos (lo dispara el elemento que esté debajo del cursor al
  // soltar, sin depender del nodo huérfano) — el margen de 150ms antes de
  // revisar le da tiempo al flujo normal de dnd-kit a resolverse solo
  // primero, así esto nunca interviene en un drag exitoso.
  useEffect(() => {
    let desmontado = false;
    const forzarCancelacion = () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true }));
      handleDragCancel();
    };
    const revisarTrasSoltar = () => {
      if (!activeCardRef.current) return;
      setTimeout(() => {
        if (!desmontado && activeCardRef.current) forzarCancelacion();
      }, 150);
    };
    const alPerderFoco = () => {
      if (activeCardRef.current) forzarCancelacion();
    };
    window.addEventListener("pointerup", revisarTrasSoltar);
    window.addEventListener("pointercancel", revisarTrasSoltar);
    window.addEventListener("blur", alPerderFoco);
    return () => {
      desmontado = true;
      window.removeEventListener("pointerup", revisarTrasSoltar);
      window.removeEventListener("pointercancel", revisarTrasSoltar);
      window.removeEventListener("blur", alPerderFoco);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      moverOportunidadDesdeMenu(oportunidad, nuevoStageId);
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

  // Mueve una oportunidad a otra etapa SIN pasar por un drag — misma
  // operación (splice local + confirmarMovimiento) que ya hacía a mano la
  // rama de las zonas rápidas Ganado/Perdido en handleDragEnd (ver abajo,
  // ahora reusa esta función); es también lo que dispara el menú ⋮ de la
  // tarjeta móvil ("Mover a etapa…", "Marcar como ganado/perdido" — ver
  // TarjetaOportunidadMovil), que no tiene ningún gesto de arrastre detrás.
  const moverOportunidadDesdeMenu = (oportunidad: OportunidadEnStage, destino: string) => {
    const origen = encontrarStageDe(oportunidad.id, localOps) ?? oportunidad.stageId;
    if (!origen || destino === origen) return;
    const nuevoStage = pipeline.stages.find((s) => s.id === destino);
    setLocalOps((prev) => {
      const next = new Map(prev);
      next.set(origen, (next.get(origen) ?? []).filter((o) => o.id !== oportunidad.id));
      next.set(destino, [
        { ...oportunidad, stageId: destino, pipelineId: pipeline.id, probabilidad: nuevoStage?.probabilidad ?? oportunidad.probabilidad },
        ...(next.get(destino) ?? []),
      ]);
      return next;
    });
    confirmarMovimiento(oportunidad, origen, destino);
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

  const stageActiva = stagesColumnas.find((s) => s.id === selectedStageId) ?? null;
  const itemsEtapaActiva = selectedStageId ? localOps.get(selectedStageId) ?? [] : [];

  return (
    <>
      {!montado ? (
        // Ni el árbol de escritorio ni el móvil todavía — evita montar (y
        // desmontar un instante después) el DndContext completo en un
        // celular real. Ver comentario en `montado` más arriba.
        <div className="space-y-3">
          <Skeleton className="h-11 w-2/3 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : esMobile ? (
        <div className="flex h-full flex-col gap-3">
          <TabsEtapasMovil
            stages={stagesColumnas}
            conteos={localConteos}
            selectedStageId={selectedStageId}
            onSelect={setSelectedStageId}
          />

          {stageActiva && (
            <div
              id={`pipeline-panel-${stageActiva.id}`}
              role="tabpanel"
              aria-labelledby={`pipeline-tab-${stageActiva.id}`}
              className="flex flex-1 flex-col gap-3 min-h-0"
            >
              <ResumenEtapaMovil
                stage={stageActiva}
                conteo={Math.max(localConteos.get(stageActiva.id) ?? 0, itemsEtapaActiva.length)}
                total={localTotales.get(stageActiva.id) ?? 0}
                pipelineId={pipeline.id}
                puedeMod={puedeMod}
              />

              {itemsEtapaActiva.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-[12.5px] text-muted-foreground">
                  Sin oportunidades en esta etapa
                </div>
              ) : (
                <div className="flex flex-col gap-3 pb-24">
                  {itemsEtapaActiva.map((op) => (
                    <TarjetaOportunidadMovil
                      key={op.id}
                      oportunidad={op}
                      stageColor={stageActiva.color ?? "#818cf8"}
                      stagesDestino={stagesColumnas.filter((s) => s.id !== stageActiva.id)}
                      onCardClick={(o) => setSelected({ id: o.id, stageId: o.stageId ?? null })}
                      onMover={moverOportunidadDesdeMenu}
                      stageGanadoId={puedeMod ? stageGanado?.id : undefined}
                      stagePerdidoId={puedeMod ? stagePerdido?.id : undefined}
                      puedeMod={puedeMod}
                    />
                  ))}
                </div>
              )}

              {hayMasPorCargar && <div ref={sentinelRef} aria-hidden className="h-px" />}
              {cargandoMas && (
                <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Cargando más oportunidades…
                </div>
              )}
            </div>
          )}

          {puedeMod && <FabNuevaOportunidad pipelineId={pipeline.id} stageId={selectedStageId} />}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={detectarColision}
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
                  scrolled={scrolled}
                />
              );
            })}
          </KanbanScrollContainer>

          {/* Centinela para "cargar más" — invisible, solo mientras falten
              oportunidades por traer en alguna etapa. Vive fuera de
              KanbanScrollContainer para no interferir con el scroll horizontal. */}
          {hayMasPorCargar && <div ref={sentinelRef} aria-hidden className="h-px" />}

          {cargandoMas && (
            <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-muted-foreground">
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
      )}

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
