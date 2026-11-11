"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProblemaValidacion, ResultadoValidacion } from "../../definicion/validador";

export function PanelValidacion({
  resultado,
  onIrANodo,
  onCerrar,
}: {
  resultado: ResultadoValidacion;
  onIrANodo: (nodoId: string) => void;
  onCerrar: () => void;
}) {
  const fila = (p: ProblemaValidacion, i: number, tipo: "error" | "advertencia") => (
    <li key={`${tipo}-${i}`}>
      <button
        type="button"
        disabled={!p.nodoId}
        onClick={() => p.nodoId && onIrANodo(p.nodoId)}
        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors enabled:hover:bg-muted"
      >
        {tipo === "error" ? (
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
        ) : (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        )}
        <span className="text-foreground">{p.mensaje}</span>
      </button>
    </li>
  );

  return (
    <div className="flex max-h-64 flex-col rounded-t-xl border border-b-0 border-border bg-card shadow-md" data-slot="panel-validacion">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {resultado.valido ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <AlertCircle className="h-4 w-4 text-danger" />
        )}
        <p className="flex-1 text-sm font-medium">
          {resultado.valido
            ? "Listo para publicar"
            : `${resultado.errores.length} ${resultado.errores.length === 1 ? "error" : "errores"} por corregir`}
          {resultado.advertencias.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              · {resultado.advertencias.length} {resultado.advertencias.length === 1 ? "advertencia" : "advertencias"}
            </span>
          )}
        </p>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Cerrar validación" onClick={onCerrar}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ul className="overflow-y-auto p-1">
        {resultado.errores.map((p, i) => fila(p, i, "error"))}
        {resultado.advertencias.map((p, i) => fila(p, i, "advertencia"))}
      </ul>
    </div>
  );
}
