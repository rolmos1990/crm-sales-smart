"use client";

import { Loader2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Banner sobre el chat cuando la IA transfirió la conversación a un humano:
// mientras esté visible, la IA no responde. El agente la reactiva a mano.
export function BarraAtencionHumana({
  motivo,
  devolviendo,
  onDevolver,
  className,
}: {
  motivo?: string | null;
  devolviendo: boolean;
  onDevolver: () => void;
  className?: string;
}) {
  return (
    <div
      data-slot="barra-atencion-humana"
      className={cn(
        "px-4 py-2.5 border-b border-border bg-muted shrink-0 flex items-center gap-3",
        className
      )}
    >
      <UserRound className="h-3.5 w-3.5 text-warning shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-foreground leading-snug font-medium">
          Atención humana — la IA no responde en esta conversación
        </p>
        {motivo && (
          <p className="text-[11px] text-muted-foreground leading-snug truncate" title={motivo}>
            Motivo de la transferencia: {motivo}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs shrink-0"
        disabled={devolviendo}
        onClick={onDevolver}
      >
        {devolviendo && <Loader2 className="h-3 w-3 animate-spin" />}
        Devolver a automático
      </Button>
    </div>
  );
}
