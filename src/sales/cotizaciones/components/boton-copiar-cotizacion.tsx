"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cambiarEstadoCotizacion } from "../actions";
import {
  construirTextoCotizacion,
  type DestinatarioCotizacionTexto,
  type EntregaCotizacionTexto,
  type LineaCotizacionTexto,
} from "../texto-cotizacion";

interface BotonCopiarCotizacionProps {
  cotizacionId: string;
  numero: string;
  estado: string;
  moneda: string;
  fechaEmision: Date;
  fechaVencimiento: Date | null;
  subtotal: number;
  impuesto: number;
  total: number;
  notas: string | null;
  costoEnvio?: number;
  destinatario: DestinatarioCotizacionTexto | undefined;
  lineas: LineaCotizacionTexto[];
  entrega?: EntregaCotizacionTexto | null;
}

export function BotonCopiarCotizacion({
  cotizacionId,
  numero,
  estado,
  moneda,
  fechaEmision,
  fechaVencimiento,
  subtotal,
  impuesto,
  total,
  notas,
  costoEnvio,
  destinatario,
  lineas,
  entrega,
}: BotonCopiarCotizacionProps) {
  const [copiado, setCopiado] = useState(false);
  const [cargando, setCargando] = useState(false);

  if (estado !== "BORRADOR" && estado !== "REVISADA") return null;

  const generarTexto = () =>
    construirTextoCotizacion({
      numero, moneda, fechaEmision, fechaVencimiento, subtotal, impuesto, costoEnvio, total, notas,
      destinatario, lineas, entrega,
    });

  const handleClick = async () => {
    setCargando(true);
    try {
      const texto = generarTexto();
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("¡Texto copiado al portapapeles!");
      setTimeout(() => setCopiado(false), 2000);

      if (estado === "BORRADOR") {
        const resultado = await cambiarEstadoCotizacion(cotizacionId, "REVISADA");
        if (resultado.exito) {
          toast.success("Cotización marcada como revisada");
        }
      }
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={cargando}>
      {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {estado === "BORRADOR" ? "Copiar y marcar revisada" : "Copiar texto"}
    </Button>
  );
}
