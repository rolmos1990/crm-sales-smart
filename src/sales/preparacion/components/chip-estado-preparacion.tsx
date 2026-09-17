import { cn } from "@/lib/utils";

export interface EstadoPreparacionChip {
  estado: { nombre: string; color: string | null; esFinal: boolean } | null;
  iniciadaEn?: Date | null;
  completadaEn?: Date | null;
}

/**
 * Chip del estado de preparación para la lista y el detalle de pedidos.
 *
 * Devuelve `null` cuando el pedido nunca entró al tablero: una instancia que no
 * usa Preparación debe ver la lista y el detalle exactamente como antes de esta
 * feature — sin chip, sin columna extra, sin espacio reservado (FR-026).
 *
 * Va deliberadamente subordinado al badge de la etapa de venta: el estado
 * comercial sigue siendo el principal. Y se rotula como "armado" para que nadie
 * lo confunda con el estado de entrega, que tiene su propio "Preparando"
 * (FR-036a).
 */
export function ChipEstadoPreparacion({
  preparacion,
  className,
}: {
  preparacion: EstadoPreparacionChip | null | undefined;
  className?: string;
}) {
  const estado = preparacion?.estado;
  if (!estado) return null;

  return (
    <span
      data-slot="chip-preparacion"
      title={`Preparación (armado interno): ${estado.nombre}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium",
        "border-border bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: estado.color ?? undefined }}
      />
      {estado.nombre}
    </span>
  );
}
