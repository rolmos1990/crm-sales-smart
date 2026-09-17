"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { registrarAvanceLineaAction } from "../actions";
import { lineaCompleta, pedidoCompleto } from "../utils/avance";
import type { TarjetaPreparacion as Tarjeta } from "../types";

interface Props {
  tarjeta: Tarjeta;
  puedeMod: boolean;
  /** El tablero pasa false mientras la tarjeta se arrastra (overlay). */
  interactiva?: boolean;
  className?: string;
}

const MAX_LINEAS_VISIBLES = 3;

export function TarjetaPreparacion({ tarjeta, puedeMod, interactiva = true, className }: Props) {
  const [expandida, setExpandida] = useState(false);

  // Avance local: el check se pinta en el mismo frame del clic y la escritura
  // viaja al servidor por detrás. Esperar la Server Action (que además
  // revalida el tablero entero) hacía que marcar un producto se sintiera
  // lento, que es justo lo contrario de lo que tiene que pasar en un tablero
  // de armado donde se marcan decenas de ítems seguidos.
  const [avanceLocal, setAvanceLocal] = useState<Record<string, number>>({});
  // Última cantidad enviada por línea: si llega el error de una petición vieja
  // (porque el usuario siguió clickeando) no se revierte lo que ya se mostró.
  const ultimoEnviado = useRef<Record<string, number>>({});

  // Reconciliación con el servidor: se descarta lo local SOLO de las líneas que
  // el servidor ya refleja. Si se borrara todo de una, marcar varios ítems
  // seguidos haría parpadear los checks — la revalidación de la primera marca
  // llegaría sin las siguientes, que todavía están viajando.
  useEffect(() => {
    setAvanceLocal((prev) => {
      const pendientes: Record<string, number> = {};
      for (const l of tarjeta.lineas) {
        const local = prev[l.id];
        if (local !== undefined && local !== l.cantidadPreparada) pendientes[l.id] = local;
      }
      return pendientes;
    });
  }, [tarjeta.lineas]);

  const lineas = useMemo(
    () =>
      tarjeta.lineas.map((l) => {
        const cantidadPreparada = avanceLocal[l.id] ?? l.cantidadPreparada;
        return { ...l, cantidadPreparada, completa: lineaCompleta({ cantidad: l.cantidad, cantidadPreparada }) };
      }),
    [tarjeta.lineas, avanceLocal],
  );

  const avanceCompleto = pedidoCompleto(lineas);
  const lineasVisibles = expandida ? lineas : lineas.slice(0, MAX_LINEAS_VISIBLES);
  const ocultas = lineas.length - lineasVisibles.length;

  const alternarLinea = async (lineaId: string, cantidad: number, cantidadPreparada: number) => {
    if (!puedeMod || !interactiva) return;
    const objetivo = cantidadPreparada >= cantidad ? 0 : cantidad;
    const previo = cantidadPreparada;

    setAvanceLocal((prev) => ({ ...prev, [lineaId]: objetivo }));
    ultimoEnviado.current[lineaId] = objetivo;

    const r = await registrarAvanceLineaAction(lineaId, objetivo);
    if (!r.exito && ultimoEnviado.current[lineaId] === objetivo) {
      setAvanceLocal((prev) => ({ ...prev, [lineaId]: previo }));
      toast.error(r.error);
    }
  };

  return (
    <article
      data-slot="tarjeta-preparacion"
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-sm transition-colors",
        avanceCompleto && "border-emerald-500/30",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="font-mono text-sm font-medium text-foreground">{tarjeta.numero}</span>
          {/* Entrega vencida: el pedido se muestra en cualquier rango, así que
              necesita decir por qué está acá. */}
          {tarjeta.atrasado && (
            <span className="shrink-0 rounded-full border border-red-500/30 px-1.5 text-[10px] font-medium text-red-600 dark:text-red-400">
              Atrasado
            </span>
          )}
          {/* Sin fecha de entrega: también se muestra en cualquier rango, pero
              vive en su columna de estado para poder arrastrarse. */}
          {tarjeta.sinFechaEntrega && (
            <span className="shrink-0 rounded-full border border-border px-1.5 text-[10px] font-medium text-muted-foreground">
              Sin fecha
            </span>
          )}
        </span>
        <time className="shrink-0 text-xs text-muted-foreground" dateTime={tarjeta.fechaPedido.toISOString()}>
          {format(new Date(tarjeta.fechaPedido), "HH:mm", { locale: es })}
        </time>
      </header>

      <p className="mt-0.5 truncate text-sm text-foreground">{tarjeta.cliente}</p>

      <ul className="mt-2 space-y-1.5">
        {lineasVisibles.map((l) => (
          <li key={l.id} className="flex items-start gap-2">
            <button
              type="button"
              disabled={!puedeMod || !interactiva}
              onClick={() => alternarLinea(l.id, l.cantidad, l.cantidadPreparada)}
              aria-label={l.completa ? `Desmarcar ${l.descripcion}` : `Marcar ${l.descripcion} como preparado`}
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                l.completa
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border bg-background hover:border-foreground/30",
                (!puedeMod || !interactiva) && "cursor-default opacity-70",
              )}
            >
              {l.completa && <Check className="size-3" strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-xs", l.completa ? "text-muted-foreground line-through" : "text-foreground")}>
                {l.cantidad} × {l.descripcion}
              </p>
              {/* El parcial es el caso que el check binario no puede contar. */}
              {!l.completa && l.cantidadPreparada > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  {l.cantidadPreparada} de {l.cantidad} preparadas
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {ocultas > 0 && (
        <button
          type="button"
          onClick={() => setExpandida(true)}
          className="mt-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          +{ocultas} producto{ocultas > 1 ? "s" : ""} más
        </button>
      )}

      <footer className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Package className="size-3" />
          {tarjeta.totalUnidades} unidad{tarjeta.totalUnidades === 1 ? "" : "es"} · {tarjeta.totalProductos} producto
          {tarjeta.totalProductos === 1 ? "" : "s"}
        </span>
        {tarjeta.fechaEntrega && (
          <span className={cn("text-[11px]", tarjeta.atrasado ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
            Entrega: {format(new Date(tarjeta.fechaEntrega), "dd MMM", { locale: es })}
          </span>
        )}
      </footer>
    </article>
  );
}
