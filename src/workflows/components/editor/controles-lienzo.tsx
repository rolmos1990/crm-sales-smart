"use client";

import { Panel, useReactFlow, useStore } from "@xyflow/react";
import { Hand, Maximize2, Minus, MousePointer2, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Con qué se arrastra en el lienzo: seleccionar en caja o desplazar la vista. */
export type ModoLienzo = "seleccion" | "mano";

export function ControlesLienzo({ modo, onModo }: { modo: ModoLienzo; onModo: (m: ModoLienzo) => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);

  return (
    <Panel position="bottom-left" className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-md">
        <BotonHerramienta etiqueta="Seleccionar (V)" activo={modo === "seleccion"} onClick={() => onModo("seleccion")}>
          <MousePointer2 className="h-4 w-4" />
        </BotonHerramienta>
        <BotonHerramienta etiqueta="Mover el lienzo (H)" activo={modo === "mano"} onClick={() => onModo("mano")}>
          <Hand className="h-4 w-4" />
        </BotonHerramienta>
      </div>

      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-md">
        <BotonHerramienta etiqueta="Alejar" onClick={() => zoomOut({ duration: 150 })}>
          <Minus className="h-4 w-4" />
        </BotonHerramienta>
        <button
          type="button"
          onClick={() => fitView({ padding: 0.3, duration: 250, maxZoom: 1 })}
          title="Ajustar a la pantalla"
          className="min-w-[3.25rem] rounded-md px-1 py-1 text-xs font-medium tabular-nums text-text-secondary transition-colors hover:bg-card-hover hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
        <BotonHerramienta etiqueta="Acercar" onClick={() => zoomIn({ duration: 150 })}>
          <Plus className="h-4 w-4" />
        </BotonHerramienta>
      </div>

      <div className="rounded-lg border border-border bg-card p-0.5 shadow-md">
        <BotonHerramienta
          etiqueta="Ajustar a la pantalla"
          onClick={() => fitView({ padding: 0.3, duration: 250, maxZoom: 1 })}
        >
          <Maximize2 className="h-4 w-4" />
        </BotonHerramienta>
      </div>
    </Panel>
  );
}

function BotonHerramienta({
  etiqueta,
  activo,
  onClick,
  children,
}: {
  etiqueta: string;
  activo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label={etiqueta}
            aria-pressed={activo}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              activo
                ? "bg-primary-muted text-primary"
                : "text-text-secondary hover:bg-card-hover hover:text-foreground",
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{etiqueta}</TooltipContent>
    </Tooltip>
  );
}
