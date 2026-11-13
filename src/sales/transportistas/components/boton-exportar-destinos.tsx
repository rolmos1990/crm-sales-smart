"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportarDestinosTransportistaAction } from "@/sales/transportistas/importacion-destinos/actions";
import {
  construirArchivoDestinos,
  nombreArchivoDestinos,
} from "@/sales/transportistas/importacion-destinos/utils/filas-exportacion-destinos";
import {
  descargarCsv,
  descargarExcel,
} from "@/sales/transportistas/importacion-destinos/utils/descargar-tabla";

// Baja los destinos del transportista con las mismas columnas que entiende la
// importación, para poder editarlos en una planilla y volver a subirlos.

interface BotonExportarDestinosProps {
  transportistaId: string;
  /** Sin tarifas cargadas no hay nada que bajar. */
  deshabilitado?: boolean;
}

export function BotonExportarDestinos({ transportistaId, deshabilitado }: BotonExportarDestinosProps) {
  const [exportando, startExportando] = useTransition();

  function exportar(formato: "csv" | "excel") {
    startExportando(async () => {
      const r = await exportarDestinosTransportistaAction(transportistaId);
      if (!r.exito) {
        toast.error(r.error);
        return;
      }
      const { transportistaNombre, destinos } = r.data!;
      if (destinos.length === 0) {
        toast.info("Este transportista todavía no tiene destinos cargados");
        return;
      }

      const { encabezados, filas } = construirArchivoDestinos(destinos);
      // La fecha se arma acá, en el navegador: es parte del nombre del
      // archivo que ve el usuario, no un dato del dominio.
      const hoy = new Date().toISOString().slice(0, 10);
      const nombre = nombreArchivoDestinos(transportistaNombre, hoy);

      if (formato === "csv") descargarCsv([encabezados, ...filas], nombre);
      else descargarExcel([encabezados, ...filas], nombre);

      toast.success(`${destinos.length} destino(s) exportado(s)`);
    });
  }

  return (
    <DropdownMenu>
      {/* El trigger se estiliza con className, no con `asChild`/`render`:
          DropdownMenu es de Base UI (mismo patrón que pedidos-filtros.tsx). */}
      <DropdownMenuTrigger
        disabled={exportando || deshabilitado}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 gap-1.5 disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Exportar destinos
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportar("csv")}>CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportar("excel")}>Excel</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
