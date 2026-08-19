"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reintentarGenerarPedido } from "../actions";

interface BotonReintentarPedidoProps {
  cotizacionId: string;
}

/**
 * Solo debe verse cuando la cotización quedó APROBADA pero, por algún motivo,
 * el manejador async todavía no generó el pedido (agotó sus reintentos
 * automáticos de RabbitMQ, o hay que forzar el intento de nuevo).
 */
export function BotonReintentarPedido({ cotizacionId }: BotonReintentarPedidoProps) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  const handleClick = async () => {
    setCargando(true);
    try {
      const resultado = await reintentarGenerarPedido(cotizacionId);
      if (resultado.exito) {
        toast.success(`Pedido ${resultado.datos.numeroPedido} generado`, {
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
      toast.error("Error al generar el pedido");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={cargando}>
      <RefreshCw className="h-4 w-4" />
      {cargando ? "Generando..." : "Reintentar generar pedido"}
    </Button>
  );
}
