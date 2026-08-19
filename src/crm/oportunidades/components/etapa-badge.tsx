import { ETAPAS_PIPELINE, type Etapa } from "../types";
import { cn } from "@/lib/utils";

interface EtapaBadgeProps {
  etapa: Etapa;
  stage?: { nombre: string; color: string | null } | null;
}

/**
 * Badge de etapa de una oportunidad — única fuente de verdad para toda la
 * app (Workspace de Oportunidades, lista de Oportunidades, Dashboard, etc.).
 *
 * La etapa real de una oportunidad con pipeline dinámico es la de su `stage`
 * actual — el enum legacy `etapa` solo se sincroniza al llegar a un stage
 * ganado/perdido, así que para cualquier otro stage (ej. "Reservado") queda
 * desactualizado y no refleja lo que se ve en el Workspace. Por eso `stage`
 * tiene precedencia y el enum es solo el fallback para oportunidades que
 * todavía no usan pipeline dinámico.
 */
export function EtapaBadge({ etapa, stage }: EtapaBadgeProps) {
  if (stage) {
    const color = stage.color ?? "#78716c";
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        {stage.nombre}
      </span>
    );
  }

  const config = ETAPAS_PIPELINE.find((e) => e.valor === etapa);
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config?.color)}>
      {config?.etiqueta ?? etapa}
    </span>
  );
}
