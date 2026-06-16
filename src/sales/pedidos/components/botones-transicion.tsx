"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moverPedidoAction } from "@/sales/flujo-venta/actions";
import { cn } from "@/lib/utils";

type EtapaOpcion = {
  id: string;
  nombre: string;
  color: string | null;
  esCancelacion: boolean;
};

interface BotonesTransicionProps {
  pedidoId: string;
  etapas: EtapaOpcion[];
}

export function BotonesTransicion({ pedidoId, etapas }: BotonesTransicionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleMover = (etapaId: string, etapaNombre: string) => {
    startTransition(async () => {
      const resultado = await moverPedidoAction(pedidoId, etapaId);
      if (resultado.exito) {
        toast.success(`Movido a "${etapaNombre}"`);
        router.refresh();
      } else {
        toast.error(resultado.error);
      }
    });
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {etapas.map((etapa) => (
        <Button
          key={etapa.id}
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleMover(etapa.id, etapa.nombre)}
          className={cn(
            "transition-all",
            etapa.esCancelacion ? "text-destructive border-destructive hover:bg-destructive/10" : ""
          )}
          style={!etapa.esCancelacion ? {
            borderColor: `${etapa.color}55`,
            color: etapa.color ?? undefined,
          } : undefined}
        >
          {isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
          {etapa.nombre}
        </Button>
      ))}
    </div>
  );
}
