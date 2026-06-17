"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const ETIQUETAS_PASOS = [
  "Tipo de datos",
  "Archivo",
  "Vista previa",
  "Mapeo",
  "Validación",
  "Importación",
];

interface IndicadorPasosProps {
  pasoActual: number;
}

export function IndicadorPasos({ pasoActual }: IndicadorPasosProps) {
  return (
    <div className="flex items-start justify-between w-full overflow-x-auto pb-2">
      {ETIQUETAS_PASOS.map((etiqueta, idx) => {
        const completado = idx < pasoActual;
        const activo = idx === pasoActual;

        return (
          <div key={etiqueta} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all",
                  completado &&
                    "bg-lime-500 text-stone-950",
                  activo &&
                    "bg-lime-500 text-stone-950 ring-4 ring-lime-500/20",
                  !completado &&
                    !activo &&
                    "bg-white/10 text-stone-400",
                )}
              >
                {completado ? (
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs whitespace-nowrap font-medium",
                  activo && "text-lime-400",
                  completado && "text-lime-400/70",
                  !activo && !completado && "text-stone-500",
                )}
              >
                {etiqueta}
              </span>
            </div>

            {idx < ETIQUETAS_PASOS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px mx-2 mt-[-14px]",
                  idx < pasoActual ? "bg-lime-500/40" : "bg-white/10",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
