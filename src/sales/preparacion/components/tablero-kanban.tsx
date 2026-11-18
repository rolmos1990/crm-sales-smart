"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { moverPreparacionAction } from "../actions";
import { LIMITE_POR_ESTADO } from "../constantes";
import { TarjetaPreparacion, type VarianteTarjeta } from "./tarjeta-preparacion";
import type { ColumnaTablero, TarjetaPreparacion as Tarjeta } from "../types";

interface Props {
  columnas: ColumnaTablero[];
  puedeMod: boolean;
  agrupacion: "POR_PEDIDO" | "POR_PRODUCTO";
  detalleSiempreVisible: boolean;
  onCargarMas: (estadoId: string) => void;
}

/** Lo que cada tarjeta necesita saber de la selección, empaquetado para no
 *  arrastrar cuatro props por columna, grupo y tarjeta. */
interface Seleccion {
  pedidoId: string | null;
  detalleSiempreVisible: boolean;
  onSeleccionar: (pedidoId: string, alternar: boolean) => void;
  onLimpiar: () => void;
}

export function TableroKanban({ columnas, puedeMod, agrupacion, detalleSiempreVisible, onCargarMas }: Props) {
  const router = useRouter();
  const [cargandoMas, setCargandoMas] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Copia local para mover la tarjeta al instante; el servidor manda y si hay
  // conflicto se revierte desde las props.
  const [local, setLocal] = useState(columnas);
  const [arrastrando, setArrastrando] = useState<Tarjeta | null>(null);
  // Una sola tarjeta seleccionada en todo el tablero. Vive acá (y no en cada
  // tarjeta) para que elegir otra cierre la anterior, y por pedidoId para que
  // sobreviva a la recarga que dispara marcar un producto.
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const seleccion: Seleccion = {
    pedidoId: seleccionadoId,
    detalleSiempreVisible,
    onSeleccionar: (pedidoId, alternar) =>
      setSeleccionadoId((actual) => (alternar && actual === pedidoId ? null : pedidoId)),
    onLimpiar: () => setSeleccionadoId(null),
  };

  useEffect(() => setLocal(columnas), [columnas]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const indice = useMemo(() => {
    const mapa = new Map<string, { tarjeta: Tarjeta; estadoId: string }>();
    for (const col of local) {
      for (const t of col.tarjetas) mapa.set(t.pedidoId, { tarjeta: t, estadoId: col.estado.id });
    }
    return mapa;
  }, [local]);

  const handleDragStart = (e: DragStartEvent) => {
    const encontrada = indice.get(String(e.active.id));
    setArrastrando(encontrada?.tarjeta ?? null);
  };

  /**
   * "Cargar más" de una columna = subir SU límite en el estado de filtros del
   * padre, que vuelve a consultar el tablero entero. Así el resultado se
   * resincroniza solo con el rango, la búsqueda y el refresh que dispara mover
   * una tarjeta, sin duplicar lógica de merge. Las demás columnas conservan su
   * propio límite.
   */
  const cargarMas = (estadoId: string) => {
    setCargandoMas(estadoId);
    onCargarMas(estadoId);
  };

  // El indicador se apaga cuando llegan las tarjetas nuevas, no antes.
  useEffect(() => setCargandoMas(null), [columnas]);

  /**
   * Resuelve a qué columna pertenece el punto donde se soltó la tarjeta.
   *
   * Las tarjetas son `useSortable`, así que también son zonas de drop: soltar
   * encima de otra tarjeta devuelve el id de ESE pedido, no el de la columna.
   * Sin esta traducción, el servidor recibe un id de pedido como estado
   * destino y responde "el estado de destino no existe".
   */
  const resolverColumnaDestino = (overId: string): string | null => {
    if (local.some((c) => c.estado.id === overId)) return overId;
    return indice.get(overId)?.estadoId ?? null;
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setArrastrando(null);
    const pedidoId = String(e.active.id);
    const estadoDestinoId = e.over ? resolverColumnaDestino(String(e.over.id)) : null;
    const origen = indice.get(pedidoId);
    if (!estadoDestinoId || !origen || origen.estadoId === estadoDestinoId) return;

    // El estado que el usuario tenía en pantalla viaja como `estadoEsperadoId`:
    // es lo que permite detectar que otro operario movió la tarjeta primero.
    const estadoEsperadoId = origen.estadoId;

    setLocal((prev) =>
      prev.map((col) => {
        // Se ajusta también el total: si no, el encabezado de una columna
        // paginada seguiría mostrando el número viejo hasta el próximo refresh.
        if (col.estado.id === estadoEsperadoId) {
          return {
            ...col,
            tarjetas: col.tarjetas.filter((t) => t.pedidoId !== pedidoId),
            total: Math.max(col.total - 1, 0),
          };
        }
        if (col.estado.id === estadoDestinoId) {
          return {
            ...col,
            tarjetas: [{ ...origen.tarjeta, estadoPreparacionId: estadoDestinoId }, ...col.tarjetas],
            total: col.total + 1,
          };
        }
        return col;
      }),
    );

    startTransition(async () => {
      const r = await moverPreparacionAction(pedidoId, estadoDestinoId, estadoEsperadoId);
      if (!r.exito) {
        toast.error(r.error);
        setLocal(columnas); // revierte el movimiento optimista
        router.refresh();
      }
    });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setArrastrando(null)}
    >
      {/* Las columnas crecen para ocupar el ancho disponible (con dos estados,
          la mitad cada una) y recién hacen scroll horizontal cuando no entran
          a su ancho mínimo. */}
      <div className="flex items-start gap-4 overflow-x-auto pb-2">
        {local.map((col) => (
          <ColumnaPreparacion
            key={col.estado.id}
            columna={col}
            puedeMod={puedeMod}
            agrupacion={agrupacion}
            seleccion={seleccion}
            tamanoPagina={LIMITE_POR_ESTADO}
            cargando={cargandoMas === col.estado.id}
            onCargarMas={() => cargarMas(col.estado.id)}
          />
        ))}
      </div>

      <DragOverlay>
        {arrastrando && (
          <TarjetaPreparacion
            tarjeta={arrastrando}
            puedeMod={false}
            interactiva={false}
            variante="resumen"
            className="rotate-1 shadow-lg"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function ColumnaPreparacion({
  columna,
  puedeMod,
  agrupacion,
  seleccion,
  tamanoPagina,
  cargando,
  onCargarMas,
}: {
  columna: ColumnaTablero;
  puedeMod: boolean;
  agrupacion: "POR_PEDIDO" | "POR_PRODUCTO";
  seleccion: Seleccion;
  tamanoPagina: number;
  cargando: boolean;
  onCargarMas: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columna.estado.id });
  const cargadas = columna.tarjetas.length;
  const faltan = Math.max(columna.total - cargadas, 0);
  const esFinal = columna.estado.esFinal;

  return (
    <section
      ref={setNodeRef}
      data-slot="columna-preparacion"
      className={cn(
        "flex min-w-[20rem] max-w-[40rem] flex-1 basis-0 flex-col gap-2 rounded-2xl bg-muted/40 p-2.5 transition-colors",
        isOver && "bg-muted/70",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-1.5 py-1">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: columna.estado.color ?? undefined }}
          />
          {columna.estado.nombre}
        </span>
        {/* Se muestra el total real, y cuántas están cargadas solo cuando no
            están todas — así el encabezado no miente en una columna paginada. */}
        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {faltan > 0 ? `${cargadas} de ${columna.total}` : columna.total}
        </span>
      </header>

      {agrupacion === "POR_PRODUCTO" ? (
        <AgrupadoPorProducto tarjetas={columna.tarjetas} puedeMod={puedeMod} esFinal={esFinal} seleccion={seleccion} />
      ) : (
        columna.tarjetas.map((t) => (
          <TarjetaArrastrable key={t.pedidoId} tarjeta={t} puedeMod={puedeMod} esFinal={esFinal} seleccion={seleccion} />
        ))
      )}

      {columna.tarjetas.length === 0 && (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">Sin pedidos en esta columna</p>
      )}

      {faltan > 0 && (
        <button
          type="button"
          onClick={onCargarMas}
          disabled={cargando}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs transition-colors",
            cargando ? "text-muted-foreground" : "text-muted-foreground hover:border-foreground/20 hover:text-foreground",
          )}
        >
          {cargando ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Cargando...
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" />
              Cargar {Math.min(faltan, tamanoPagina)} más
            </>
          )}
        </button>
      )}
    </section>
  );
}

/**
 * Qué tan desplegada se ve una tarjeta:
 * - en la columna final, siempre como "preparado" (ya no hay nada que marcar);
 * - si la configuración pide el detalle siempre visible, en detalle;
 * - si no, solo la seleccionada se despliega y el resto queda en resumen.
 */
function resolverVariante(esFinal: boolean, seleccionada: boolean, detalleSiempreVisible: boolean): VarianteTarjeta {
  if (esFinal) return "preparado";
  if (detalleSiempreVisible || seleccionada) return "detalle";
  return "resumen";
}

function TarjetaArrastrable({
  tarjeta,
  puedeMod,
  esFinal,
  seleccion,
}: {
  tarjeta: Tarjeta;
  puedeMod: boolean;
  esFinal: boolean;
  seleccion: Seleccion;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarjeta.pedidoId,
    disabled: !puedeMod,
  });
  const seleccionada = seleccion.pedidoId === tarjeta.pedidoId;
  const variante = resolverVariante(esFinal, seleccionada, seleccion.detalleSiempreVisible);

  // Un clic sobre un control de la tarjeta (un check, "+N productos") la
  // selecciona pero nunca la cierra: marcar productos no debe plegar la
  // tarjeta que se está armando. Un clic en cualquier otra parte alterna.
  const alClic = (e: React.MouseEvent<HTMLDivElement>) => {
    const sobreControl = (e.target as HTMLElement).closest("button, a, input") !== null;
    seleccion.onSeleccionar(tarjeta.pedidoId, !sobreControl);
  };

  // Solo PointerSensor está registrado, así que el teclado queda libre para
  // seleccionar: Enter/Espacio sobre la tarjeta enfocada la abre, Escape la cierra.
  const alTecla = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      seleccion.onSeleccionar(tarjeta.pedidoId, true);
    } else if (e.key === "Escape" && seleccionada) {
      seleccion.onLimpiar();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
      aria-expanded={variante === "preparado" ? undefined : variante === "detalle"}
      onClick={alClic}
      onKeyDown={alTecla}
    >
      <TarjetaPreparacion
        tarjeta={tarjeta}
        puedeMod={puedeMod}
        variante={variante}
        seleccionada={seleccionada}
        className="cursor-pointer"
      />
    </div>
  );
}

function AgrupadoPorProducto({
  tarjetas,
  puedeMod,
  esFinal,
  seleccion,
}: {
  tarjetas: Tarjeta[];
  puedeMod: boolean;
  esFinal: boolean;
  seleccion: Seleccion;
}) {
  const grupos = useMemo(() => {
    const mapa = new Map<string, { nombre: string; unidades: number; tarjetas: Tarjeta[] }>();
    for (const t of tarjetas) {
      for (const l of t.lineas) {
        const clave = l.producto?.id ?? `libre:${l.descripcion.toLowerCase()}`;
        const g = mapa.get(clave) ?? { nombre: l.producto?.nombre ?? l.descripcion, unidades: 0, tarjetas: [] };
        g.unidades += l.cantidad;
        if (!g.tarjetas.some((x) => x.pedidoId === t.pedidoId)) g.tarjetas.push(t);
        mapa.set(clave, g);
      }
    }
    return [...mapa.values()].sort((a, b) => b.unidades - a.unidades);
  }, [tarjetas]);

  return (
    <div className="space-y-3">
      {grupos.map((g) => (
        <div key={g.nombre} className="space-y-1.5">
          <p className="px-1 text-xs font-medium text-muted-foreground">
            {g.nombre} · {g.unidades} u.
          </p>
          {g.tarjetas.map((t) => (
            <TarjetaArrastrable
              key={`${g.nombre}-${t.pedidoId}`}
              tarjeta={t}
              puedeMod={puedeMod}
              esFinal={esFinal}
              seleccion={seleccion}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
