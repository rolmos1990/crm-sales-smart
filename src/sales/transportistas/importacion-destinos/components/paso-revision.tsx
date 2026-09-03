"use client";

import { AlertTriangle, CheckCircle2, HelpCircle, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { DecisionFilaDestino, FilaRevisionDestino, ResumenRevisionDestinos } from "../types";

interface PasoRevisionProps {
  filas: FilaRevisionDestino[];
  decisiones: DecisionFilaDestino[];
  resumen: ResumenRevisionDestinos;
  onDecisionChange: (indice: number, decision: DecisionFilaDestino) => void;
}

const ETIQUETA_ESTADO: Record<FilaRevisionDestino["estado"], { label: string; icono: typeof CheckCircle2 }> = {
  NUEVO: { label: "Nuevo destino", icono: PlusCircle },
  COINCIDENCIA_EXACTA: { label: "Coincidencia exacta", icono: CheckCircle2 },
  POSIBLE_DUPLICADO: { label: "Posible duplicado", icono: HelpCircle },
  ALIAS_AMBIGUO: { label: "Alias ambiguo", icono: AlertTriangle },
  INCOMPLETA: { label: "Incompleta", icono: AlertTriangle },
};

// 024-alias-ubicaciones-transportistas (FR-012/FR-013) — tabla agrupada por
// estado, sin grid editable (no hay precedente de ese tipo de componente en
// el proyecto — research.md). Las filas ALIAS_AMBIGUO/INCOMPLETA quedan
// bloqueadas: no se pueden incluir hasta resolverse fuera de este wizard.
export function PasoRevision({ filas, decisiones, resumen, onDecisionChange }: PasoRevisionProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">{resumen.nuevos} nuevos</Badge>
        <Badge variant="outline">{resumen.coincidenciaExacta} coincidencia exacta</Badge>
        {resumen.posiblesDuplicados > 0 && <Badge variant="outline">{resumen.posiblesDuplicados} posibles duplicados</Badge>}
        {resumen.aliasAmbiguos > 0 && <Badge variant="destructive">{resumen.aliasAmbiguos} alias ambiguos</Badge>}
        {resumen.incompletas > 0 && <Badge variant="destructive">{resumen.incompletas} incompletas</Badge>}
      </div>

      <div className="rounded-xl border border-border divide-y divide-border max-h-[50vh] overflow-y-auto">
        {filas.map((fila, idx) => {
          const { label, icono: Icono } = ETIQUETA_ESTADO[fila.estado];
          const decision = decisiones[idx];
          const bloqueada = fila.estado === "ALIAS_AMBIGUO" || fila.estado === "INCOMPLETA";

          return (
            <div key={fila.fila} className="flex items-start justify-between gap-3 p-3">
              <div className="flex items-start gap-2 min-w-0">
                {!bloqueada && (
                  <Checkbox
                    checked={decision.incluir}
                    onCheckedChange={(checked) => onDecisionChange(idx, checked ? { incluir: true, usarExistenteId: decision.incluir ? decision.usarExistenteId : undefined } : { incluir: false })}
                    className="mt-0.5"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    Fila {fila.fila} — {fila.datos.zonaNombre || fila.datos.provinciaEstado}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Icono className="h-3 w-3" />
                    {label}
                    {fila.motivo ? ` — ${fila.motivo}` : ""}
                  </p>

                  {fila.estado === "POSIBLE_DUPLICADO" && fila.candidatos[0] && (
                    <div className="flex gap-1.5 mt-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={!decision.incluir || decision.usarExistenteId ? "outline" : "default"}
                        className="h-6 text-xs px-2"
                        onClick={() => onDecisionChange(idx, { incluir: true, usarExistenteId: undefined })}
                      >
                        Crear como destino nuevo
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={decision.incluir && decision.usarExistenteId ? "default" : "outline"}
                        className="h-6 text-xs px-2"
                        onClick={() => onDecisionChange(idx, { incluir: true, usarExistenteId: fila.candidatos[0].zonaEntregaUbicacionId })}
                      >
                        Es el mismo destino que: {fila.candidatos[0].nombreVisible}
                      </Button>
                    </div>
                  )}

                  {fila.estado === "ALIAS_AMBIGUO" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Coincide con: {fila.candidatos.map((c) => c.nombreVisible).join(", ")} — editá el archivo para desambiguar
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
