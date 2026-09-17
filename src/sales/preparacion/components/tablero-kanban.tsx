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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { moverPreparacionAction } from "../actions";
import { TarjetaPreparacion } from "./tarjeta-preparacion";
import { GRUPO_SIN_FECHA } from "../constantes";
import type { ColumnaTablero, TarjetaPreparacion as Tarjeta } from "../types";

interface Props {
  columnas: ColumnaTablero[];
  sinFecha: Tarjeta[];
  puedeMod: boolean;
  agrupacion: "POR_PEDIDO" | "POR_PRODUCTO";
}

export function TableroKanban({ columnas, sinFecha, puedeMod, agrupacion }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Copia local para mover la tarjeta al instante; el servidor manda y si hay
  // conflicto se revierte desde las props.
  const [local, setLocal] = useState(columnas);
  const [arrastrando, setArrastrando] = useState<Tarjeta | null>(null);

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

  const handleDragEnd = (e: DragEndEvent) => {
    setArrastrando(null);
    const pedidoId = String(e.active.id);
    const estadoDestinoId = e.over ? String(e.over.id) : null;
    const origen = indice.get(pedidoId);
    if (!estadoDestinoId || !origen || origen.estadoId === estadoDestinoId) return;

    // El estado que el usuario tenía en pantalla viaja como `estadoEsperadoId`:
    // es lo que permite detectar que otro operario movió la tarjeta primero.
    const estadoEsperadoId = origen.estadoId;

    setLocal((prev) =>
      prev.map((col) => {
        if (col.estado.id === estadoEsperadoId) {
          return { ...col, tarjetas: col.tarjetas.filter((t) => t.pedidoId !== pedidoId) };
        }
        if (col.estado.id === estadoDestinoId) {
          return { ...col, tarjetas: [{ ...origen.tarjeta, estadoPreparacionId: estadoDestinoId }, ...col.tarjetas] };
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
      <div className="flex gap-3 overflow-x-auto pb-2">
        {local.map((col) => (
          <ColumnaPreparacion key={col.estado.id} columna={col} puedeMod={puedeMod} agrupacion={agrupacion} />
        ))}
        {sinFecha.length > 0 && <ColumnaSinFecha tarjetas={sinFecha} puedeMod={puedeMod} />}
      </div>

      <DragOverlay>
        {arrastrando && (
          <TarjetaPreparacion tarjeta={arrastrando} puedeMod={false} interactiva={false} className="rotate-2 shadow-lg" />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function ColumnaPreparacion({
  columna,
  puedeMod,
  agrupacion,
}: {
  columna: ColumnaTablero;
  puedeMod: boolean;
  agrupacion: "POR_PEDIDO" | "POR_PRODUCTO";
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columna.estado.id });

  return (
    <section
      ref={setNodeRef}
      data-slot="columna-preparacion"
      className={cn(
        "flex w-[19rem] shrink-0 flex-col gap-2 rounded-2xl border border-border bg-muted/30 p-2.5 transition-colors",
        isOver && "border-foreground/20 bg-muted/60",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: columna.estado.color ?? undefined }}
          />
          {columna.estado.nombre}
        </span>
        <span className="text-xs text-muted-foreground">{columna.tarjetas.length}</span>
      </header>

      {agrupacion === "POR_PRODUCTO" ? (
        <AgrupadoPorProducto tarjetas={columna.tarjetas} puedeMod={puedeMod} />
      ) : (
        columna.tarjetas.map((t) => <TarjetaArrastrable key={t.pedidoId} tarjeta={t} puedeMod={puedeMod} />)
      )}

      {columna.tarjetas.length === 0 && (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">Sin pedidos en esta columna</p>
      )}
    </section>
  );
}

/** Los pedidos sin fecha de entrega nunca se ocultan por el filtro de rango:
 *  van a su propia columna, no arrastrable (FR-019). */
function ColumnaSinFecha({ tarjetas, puedeMod }: { tarjetas: Tarjeta[]; puedeMod: boolean }) {
  return (
    <section className="flex w-[19rem] shrink-0 flex-col gap-2 rounded-2xl border border-dashed border-border bg-muted/20 p-2.5">
      <header className="flex items-center justify-between gap-2 px-1">
        <span className="text-sm font-medium text-muted-foreground">{GRUPO_SIN_FECHA}</span>
        <span className="text-xs text-muted-foreground">{tarjetas.length}</span>
      </header>
      {tarjetas.map((t) => (
        <TarjetaPreparacion key={t.pedidoId} tarjeta={t} puedeMod={puedeMod} />
      ))}
    </section>
  );
}

function TarjetaArrastrable({ tarjeta, puedeMod }: { tarjeta: Tarjeta; puedeMod: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarjeta.pedidoId,
    disabled: !puedeMod,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <TarjetaPreparacion tarjeta={tarjeta} puedeMod={puedeMod} />
    </div>
  );
}

function AgrupadoPorProducto({ tarjetas, puedeMod }: { tarjetas: Tarjeta[]; puedeMod: boolean }) {
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
            <TarjetaArrastrable key={`${g.nombre}-${t.pedidoId}`} tarjeta={t} puedeMod={puedeMod} />
          ))}
        </div>
      ))}
    </div>
  );
}
