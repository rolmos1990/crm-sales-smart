"use client";

import { findVariableByKey } from "@/configuracion/plantillas/variable-defs";

interface VistaPreviaPlantillaProps {
  contenido: string;
}

type Parte = { tipo: "texto"; valor: string } | { tipo: "var"; key: string };

function parsear(contenido: string): Parte[] {
  const partes: Parte[] = [];
  const regex = /\{\{([\w.]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(contenido)) !== null) {
    if (match.index > lastIndex) {
      partes.push({ tipo: "texto", valor: contenido.slice(lastIndex, match.index) });
    }
    partes.push({ tipo: "var", key: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < contenido.length) {
    partes.push({ tipo: "texto", valor: contenido.slice(lastIndex) });
  }
  return partes;
}

export function VistaPreviaPlantilla({ contenido }: VistaPreviaPlantillaProps) {
  if (!contenido.trim()) {
    return (
      <p className="text-xs text-stone-600 italic">
        El contenido de la vista previa aparecerá aquí…
      </p>
    );
  }

  const partes = parsear(contenido);

  return (
    <div className="text-sm text-stone-300 leading-relaxed">
      {partes.map((parte, i) => {
        if (parte.tipo === "texto") {
          return (
            <span key={i}>
              {parte.valor.split("\n").map((linea, li, arr) => (
                <span key={li}>
                  {linea}
                  {li < arr.length - 1 && <br />}
                </span>
              ))}
            </span>
          );
        }

        const variable = findVariableByKey(parte.key);
        const muestra = variable?.sampleValue;

        if (muestra) {
          // Variable con dato de ejemplo: texto coloreado, sin chip
          return (
            <span key={i} className="text-lime-400 font-medium">
              {muestra}
            </span>
          );
        }

        // Variable sin dato de ejemplo: texto tenue indicando el campo
        return (
          <span key={i} className="text-stone-500 italic text-xs">
            [{variable?.label ?? parte.key}]
          </span>
        );
      })}
    </div>
  );
}
