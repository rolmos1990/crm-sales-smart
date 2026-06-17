"use client";

import {
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Download,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResultadoImportacion } from "../types";

interface PasoImportacionProps {
  resultado: ResultadoImportacion | null;
  registrosAImportar: number;
  cargando: boolean;
  onEjecutar: () => void;
  onReiniciar: () => void;
}

export function PasoImportacion({
  resultado,
  registrosAImportar,
  cargando,
  onEjecutar,
  onReiniciar,
}: PasoImportacionProps) {
  const descargarErrores = () => {
    if (!resultado || resultado.errores.length === 0) return;
    const cabeceras = ["Fila", "Campo", "Mensaje"];
    const filas = resultado.errores.map((e) => [
      String(e.fila),
      e.campo,
      e.mensaje,
    ]);
    const csv = [cabeceras, ...filas]
      .map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "errores-importacion.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-lime-500/10 border border-lime-500/20">
          <Loader2 className="w-8 h-8 text-lime-400 animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-stone-100 font-semibold text-lg">
            Importando registros...
          </p>
          <p className="text-stone-400 text-sm mt-1">
            Esto puede tomar unos segundos.
          </p>
        </div>
      </div>
    );
  }

  if (resultado) {
    const hayErrores = resultado.conError > 0;
    const todoExitoso = !hayErrores && resultado.exitosos > 0;

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold text-stone-50">
            {todoExitoso ? "Importación completada" : "Importación finalizada"}
          </h2>
          <p className="text-sm text-stone-400 mt-1">
            {todoExitoso
              ? "Todos los registros fueron importados correctamente."
              : "Algunos registros no pudieron importarse."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-6 text-center",
              resultado.exitosos > 0
                ? "border-lime-500/20 bg-lime-500/5"
                : "border-white/10 bg-white/5",
            )}
          >
            <CheckCircle2
              className={cn(
                "w-8 h-8",
                resultado.exitosos > 0 ? "text-lime-400" : "text-stone-600",
              )}
            />
            <p
              className={cn(
                "text-3xl font-bold",
                resultado.exitosos > 0 ? "text-lime-300" : "text-stone-400",
              )}
            >
              {resultado.exitosos}
            </p>
            <p className="text-xs text-stone-400 uppercase tracking-wide">
              Importados
            </p>
          </div>

          <div
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-6 text-center",
              hayErrores
                ? "border-red-500/20 bg-red-500/5"
                : "border-white/10 bg-white/5",
            )}
          >
            <XCircle
              className={cn(
                "w-8 h-8",
                hayErrores ? "text-red-400" : "text-stone-600",
              )}
            />
            <p
              className={cn(
                "text-3xl font-bold",
                hayErrores ? "text-red-300" : "text-stone-400",
              )}
            >
              {resultado.conError}
            </p>
            <p className="text-xs text-stone-400 uppercase tracking-wide">
              Con errores
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {hayErrores ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={descargarErrores}
              className="text-stone-400 hover:text-stone-200 gap-1"
            >
              <Download className="w-4 h-4" />
              Descargar errores
            </Button>
          ) : (
            <div />
          )}

          <Button
            onClick={onReiniciar}
            className="bg-lime-500/90 text-stone-950 rounded-xl hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Nueva importación
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-50">Importar</h2>
        <p className="text-sm text-stone-400 mt-1">
          Todo listo para importar tus datos.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-lime-500/10 border border-lime-500/20">
          <Upload className="w-7 h-7 text-lime-400" />
        </div>
        <div>
          <p className="text-stone-100 font-semibold text-lg">
            {registrosAImportar} registros listos
          </p>
          <p className="text-stone-400 text-sm mt-1">
            Haz clic en el botón para iniciar la importación.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div />
        <Button
          onClick={onEjecutar}
          className="bg-lime-500/90 text-stone-950 rounded-xl hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] gap-2"
        >
          <Upload className="w-4 h-4" />
          Iniciar importación
        </Button>
      </div>
    </div>
  );
}
