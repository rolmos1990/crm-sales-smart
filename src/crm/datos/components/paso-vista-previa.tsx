"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DatosArchivo } from "../types";

interface PasoVistaPreviaProps {
  archivo: DatosArchivo;
  onConfirmar: () => void;
  onAtras: () => void;
}

export function PasoVistaPrevia({
  archivo,
  onConfirmar,
  onAtras,
}: PasoVistaPreviaProps) {
  const filasMostradas = Math.min(50, archivo.filasTotales);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-50">Vista previa</h2>
        <p className="text-sm text-stone-400 mt-1">
          Revisa que los datos se hayan cargado correctamente.
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm text-stone-400">
        <span>
          <span className="text-stone-200 font-medium">{archivo.nombre}</span>
        </span>
        <span>·</span>
        <span>
          Mostrando{" "}
          <span className="text-stone-200 font-medium">{filasMostradas}</span>{" "}
          de{" "}
          <span className="text-stone-200 font-medium">
            {archivo.filasTotales}
          </span>{" "}
          registros
        </span>
        <span>·</span>
        <span>
          <span className="text-stone-200 font-medium">
            {archivo.encabezados.length}
          </span>{" "}
          columnas
        </span>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/4 overflow-hidden">
        <ScrollArea className="h-[380px]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-stone-950/90 backdrop-blur-sm z-10">
                <tr>
                  <th className="text-left px-3 py-2.5 text-stone-500 text-xs font-medium border-b border-white/8 w-10">
                    #
                  </th>
                  {archivo.encabezados.map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2.5 text-stone-400 text-xs font-medium border-b border-white/8 whitespace-nowrap min-w-[120px]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {archivo.filas.map((fila, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-white/5 hover:bg-white/4 transition-colors"
                  >
                    <td className="px-3 py-2 text-stone-600 text-xs">
                      {idx + 1}
                    </td>
                    {archivo.encabezados.map((h) => (
                      <td
                        key={h}
                        className="px-3 py-2 text-stone-300 text-xs whitespace-nowrap max-w-[200px] truncate"
                      >
                        {fila[h] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onAtras}
          className="text-stone-400 hover:text-stone-200"
        >
          ← Volver
        </Button>
        <Button
          onClick={onConfirmar}
          className="bg-lime-500/90 text-stone-950 rounded-xl hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02]"
        >
          Continuar con el mapeo <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
