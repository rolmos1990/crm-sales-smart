"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { eliminarCotizacion } from "../actions";

interface BotonEliminarCotizacionProps {
  cotizacionId: string;
  numero: string;
  estado: string;
}

export function BotonEliminarCotizacion({ cotizacionId, numero, estado }: BotonEliminarCotizacionProps) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  // Solo se puede descartar mientras la cotización siga en borrador (no enviada)
  if (estado !== "BORRADOR") return null;

  const handleEliminar = async () => {
    setCargando(true);
    try {
      const resultado = await eliminarCotizacion(cotizacionId);
      if (resultado.exito) {
        toast.success("Cotización eliminada");
        router.push("/sales/cotizaciones");
      } else {
        toast.error(resultado.error);
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <ConfirmacionDialog
      trigger={
        <Button variant="outline" size="sm" disabled={cargando} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />Descartar
        </Button>
      }
      titulo="¿Descartar cotización?"
      descripcion={`Se eliminará la cotización ${numero}. Esta acción no se puede deshacer.`}
      onConfirmar={handleEliminar}
    />
  );
}
