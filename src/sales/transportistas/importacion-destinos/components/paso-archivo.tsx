"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parsearArchivo } from "@/crm/datos/utils/parsear-archivo";
import type { DatosArchivo } from "@/crm/datos/types";

interface PasoArchivoProps {
  onArchivoParseado: (datos: DatosArchivo) => void;
}

// 024-alias-ubicaciones-transportistas — reutiliza parsearArchivo() de
// src/crm/datos/ tal cual (research.md §7), sin forkear el wizard genérico.
// La vista previa que devuelve esa función está acotada a 50 filas — más
// que suficiente para el caso de uso de esta importación (SC-002: 30+
// destinos), y evita duplicar/mantener una segunda utilidad de parseo.
export function PasoArchivo({ onArchivoParseado }: PasoArchivoProps) {
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleArchivo(archivo: File) {
    setCargando(true);
    try {
      const datos = await parsearArchivo(archivo);
      if (datos.filas.length === 0) {
        toast.error("El archivo no tiene filas de datos");
        return;
      }
      onArchivoParseado(datos);
    } catch {
      toast.error("No se pudo leer el archivo — confirmá que sea un CSV o Excel válido");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
      {cargando ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : (
        <FileUp className="h-8 w-8 text-muted-foreground" />
      )}
      <p className="text-sm text-muted-foreground">Subí un archivo CSV o Excel con tus destinos y tarifas</p>
      <Button type="button" variant="outline" size="sm" disabled={cargando} onClick={() => inputRef.current?.click()}>
        Elegir archivo
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        className="hidden"
        disabled={cargando}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) void handleArchivo(archivo);
          e.target.value = "";
        }}
      />
    </div>
  );
}
