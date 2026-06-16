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

  if (estado !== "ENVIADA" && estado !== "BORRADOR") return null;

  const handleClick = async () => {
    setCargando(true);
    try {
      const resultado = await aprobarCotizacion(cotizacionId);
      if (resultado.exito) {
        toast.success(`Cotización aprobada — Pedido ${resultado.datos.numeroPedido} creado`, {
          action: {
            label: "Ver pedido",
            onClick: () => router.push(`/sales/pedidos/${resultado.datos.pedidoId}`),
          },
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
