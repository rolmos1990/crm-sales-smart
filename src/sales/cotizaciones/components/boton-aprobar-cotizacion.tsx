"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aprobarCotizacion } from "../actions";

interface BotonAprobarCotizacionProps {
  cotizacionId: string;
  estado: string;
}

export function BotonAprobarCotizacion({ cotizacionId, estado }: BotonAprobarCotizacionProps) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  if (estado !== "REVISADA" && estado !== "BORRADOR") return null;

  const handleClick = async () => {
    setCargando(true);
    try {
      const resultado = await aprobarCotizacion(cotizacionId);
      if (resultado.exito) {
        // El pedido se genera en segundo plano (ver CotizacionAprobadaSuscriptor)
        // — todavía no hay pedidoId/numero en este punto para enlazarlo.
        toast.success("Cotización aprobada", {
          description: "El pedido se está generando y va a aparecer en Pedidos en unos segundos.",
        });
        router.refresh();
      } else {
        toast.error(resultado.error);
      }
    } catch {
      toast.error("Error al aprobar la cotización");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Button size="sm" onClick={handleClick} disabled={cargando}>
      <CheckCircle2 className="h-4 w-4" />
      {cargando ? "Aprobando..." : "Aprobar y crear pedido"}
    </Button>
  );
}
