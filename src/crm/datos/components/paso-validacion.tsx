"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Download, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { EntidadImportable, ResultadoValidacion } from "../types";

interface PasoValidacionProps {
  validacion: ResultadoValidacion;
  entidad?: EntidadImportable;
  onConfirmar: (soloValidos: boolean) => void;
  onAtras: () => void;
}

export function PasoValidacion({
  validacion,
  entidad,
  onConfirmar,
  onAtras,
}: PasoValidacionProps) {
  const [soloValidos, setSoloValidos] = useState(validacion.conError > 0);

  const puedeImportar =
    validacion.validos > 0 || (!soloValidos && validacion.total > 0);

  const descargarErrores = () => {
    if (validacion.errores.length === 0) return;
    const cabeceras = ["Fila", "Campo", "Mensaje", "Valor"];
    const filas = validacion.errores.map((e) => [
      String(e.fila),
      e.campo,
      e.mensaje,
      e.valor ?? "",
    ]);
    const csv = [cabeceras, ...filas]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "errores-importacion.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-50">Validación</h2>
        <p className="text-sm text-stone-400 mt-1">
          Revisa los errores encontrados antes de importar.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-2xl font-bold text-stone-100">
            {validacion.total}
          </p>
          <p className="text-xs text-stone-400 uppercase tracking-wide">
            Total
          </p>
        </div>
        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4 text-center",
            validacion.validos > 0
              ? "border-lime-500/20 bg-lime-500/5"
              : "border-white/10 bg-white/5",
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2
              className={cn(
                "w-5 h-5",
                validacion.validos > 0 ? "text-lime-400" : "text-stone-600",
              )}
            />
            <p
              className={cn(
                "text-2xl font-bold",
                validacion.validos > 0 ? "text-lime-300" : "text-stone-400",
              )}
            >
              {validacion.validos}
            </p>
          </div>
          <p className="text-xs text-stone-400 uppercase tracking-wide">
            Válidos
          </p>
        </div>
        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4 text-center",
            validacion.conError > 0
              ? "border-red-500/20 bg-red-500/5"
              : "border-white/10 bg-white/5",
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <XCircle
              className={cn(
                "w-5 h-5",
                validacion.conError > 0 ? "text-red-400" : "text-stone-600",
              )}
            />
            <p
              className={cn(
                "text-2xl font-bold",
                validacion.conError > 0 ? "text-red-300" : "text-stone-400",
              )}
            >
              {validacion.conError}
            </p>
          </div>
          <p className="text-xs text-stone-400 uppercase tracking-wide">
            Con errores
          </p>
        </div>
      </div>

      {entidad === "OPORTUNIDAD" && (() => {
        const conContacto = validacion.filasValidas.filter(
          (f) =>
            (f as Record<string, unknown>).contactoEmail ||
            (f as Record<string, unknown>).contactoTelefono,
        ).length;
        return conContacto > 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-blue-400/20 bg-blue-400/5 p-4">
            <Users className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-stone-200 text-sm font-medium">
                {conContacto} {conContacto === 1 ? "registro" : "registros"} con datos de contacto
              </p>
              <p className="text-stone-500 text-xs mt-0.5">
                Se vincularán a un contacto existente o se creará uno nuevo.
              </p>
            </div>
          </div>
        ) : null;
      })()}

      {validacion.errores.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-stone-300 text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Detalle de errores
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={descargarErrores}
              className="text-stone-400 hover:text-stone-200 text-xs gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar CSV
            </Button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/4 overflow-hidden">
            <ScrollArea className="h-[200px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-stone-950/90 backdrop-blur-sm">
                  <tr>
                    {["Fila", "Campo", "Mensaje", "Valor"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 text-stone-500 font-medium border-b border-white/8"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validacion.errores.map((error, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-white/5 hover:bg-white/4"
                    >
                      <td className="px-3 py-2 text-stone-400">
                        {error.fila}
                      </td>
                      <td className="px-3 py-2 text-stone-300 font-medium">
                        {error.campo}
                      </td>
                      <td className="px-3 py-2 text-red-400">{error.mensaje}</td>
                      <td className="px-3 py-2 text-stone-500 max-w-[150px] truncate">
                        {error.valor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <Label className="text-stone-200 text-sm font-medium">
                Importar solo registros válidos
              </Label>
              <p className="text-stone-500 text-xs mt-0.5">
                Se omitirán los {validacion.conError} registros con errores
              </p>
            </div>
            <Switch
              checked={soloValidos}
              onCheckedChange={setSoloValidos}
            />
          </div>
        </div>
      )}

      {validacion.validos === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-red-400 text-sm">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          No hay registros válidos para importar. Revisa el mapeo de columnas.
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onAtras}
          className="text-stone-400 hover:text-stone-200"
        >
          ← Volver
        </Button>
        <Button
          onClick={() => onConfirmar(soloValidos)}
          disabled={!puedeImportar}
          className="bg-lime-500/90 text-stone-950 rounded-xl hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          Iniciar importación <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
