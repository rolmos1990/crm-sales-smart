import type { ReactNode } from "react";
import { Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_NEUTRO = "#a8a29e";

export interface EtiquetaBasica {
  id: string;
  nombre: string;
  color: string | null;
}

/**
 * Chip de etiqueta de producto. El color es dato del negocio (elegido de
 * COLORES_TAG), por eso va en `style` y no en una clase.
 */
export function ChipEtiqueta({
  etiqueta,
  activa,
  onClick,
  sufijo,
  className,
}: {
  etiqueta: EtiquetaBasica;
  /** En modo filtro: resalta la etiqueta seleccionada. */
  activa?: boolean;
  onClick?: () => void;
  sufijo?: ReactNode;
  className?: string;
}) {
  const color = etiqueta.color ?? COLOR_NEUTRO;
  const estilo = {
    color,
    borderColor: `${color}${activa ? "cc" : "55"}`,
    backgroundColor: `${color}${activa ? "33" : "1a"}`,
  };
  const contenido = (
    <>
      <TagIcon className="h-3 w-3 shrink-0" />
      <span className="truncate">{etiqueta.nombre}</span>
      {sufijo}
    </>
  );
  const clases = cn(
    "inline-flex max-w-40 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
    className,
  );

  if (!onClick) {
    return (
      <span data-slot="chip-etiqueta" className={clases} style={estilo} title={etiqueta.nombre}>
        {contenido}
      </span>
    );
  }
  return (
    <button
      type="button"
      data-slot="chip-etiqueta"
      aria-pressed={activa}
      onClick={onClick}
      title={etiqueta.nombre}
      className={cn(clases, "cursor-pointer transition-all outline-none hover:brightness-125 focus-visible:ring-2 focus-visible:ring-ring/50", activa && "ring-1 ring-current/40")}
      style={estilo}
    >
      {contenido}
    </button>
  );
}
