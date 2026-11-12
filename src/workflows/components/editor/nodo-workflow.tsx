"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATALOGO_NODOS, type SalidaNodo } from "../../definicion/catalogo-nodos";
import type { NodoWorkflow } from "../../definicion/schema";
import { ESTILO_CATEGORIA } from "../estilos";
import { ICONOS_NODO } from "./iconos";

export type DatosNodoFlow = {
  nodo: NodoWorkflow;
  resumen: string | null;
  salidas: SalidaNodo[];
  problemas: string[];
};
export type NodoFlow = Node<DatosNodoFlow, "workflow">;

const HANDLE =
  "!h-2.5 !w-2.5 !border-2 !border-card !bg-border-strong transition-colors hover:!bg-primary hover:!h-3 hover:!w-3";

function NodoWorkflowBase({ data, selected }: NodeProps<NodoFlow>) {
  const { nodo, resumen, salidas, problemas } = data;
  const tipo = CATALOGO_NODOS[nodo.tipo];
  const estilo = ESTILO_CATEGORIA[tipo.categoria];
  const Icono = ICONOS_NODO[tipo.icono];
  const unaSalida = salidas.length === 1;
  const conProblemas = problemas.length > 0;

  return (
    <div
      data-slot="nodo-workflow"
      // Sin overflow-hidden: los handles se dibujan fuera del borde y se recortarían.
      className={cn(
        "w-64 rounded-xl border bg-card transition-all duration-150",
        selected
          ? cn("shadow-lg ring-2", estilo.anillo)
          : conProblemas
            ? "border-danger-border shadow-sm hover:shadow-md"
            : "border-card-border shadow-sm hover:border-border-strong hover:shadow-md",
      )}
    >
      {nodo.tipo !== "INICIO" && <Handle type="target" position={Position.Top} id="entrada" className={HANDLE} />}

      <div className={cn("h-1 rounded-t-xl", estilo.acento)} />

      <div className="flex items-start gap-2.5 p-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", estilo.chip)}>
          {Icono && <Icono className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "truncate rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                estilo.badge,
              )}
            >
              {tipo.etiqueta}
            </span>
            {conProblemas && (
              <span title={problemas.join("\n")} className="ml-auto shrink-0 text-danger">
                <AlertCircle className="h-3.5 w-3.5" aria-label={`${problemas.length} problema(s)`} />
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm font-semibold leading-tight text-foreground">
            {nodo.etiqueta?.trim() || tipo.etiqueta}
          </p>
          {resumen ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{resumen}</p>
          ) : (
            <p className="mt-1 text-[11px] italic leading-snug text-text-disabled">Sin configurar</p>
          )}
        </div>
      </div>

      {unaSalida && <Handle type="source" position={Position.Bottom} id={salidas[0].id} className={HANDLE} />}

      {salidas.length > 1 && (
        <ul className="border-t border-card-divider">
          {salidas.map((s) => (
            <li
              key={s.id}
              className="relative flex items-center justify-end border-b border-card-divider px-3 py-1.5 last:border-b-0"
            >
              <span className="truncate text-[11px] leading-none text-text-secondary">{s.etiqueta}</span>
              <Handle type="source" position={Position.Right} id={s.id} className={HANDLE} style={{ top: "50%" }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const NodoWorkflowFlow = memo(NodoWorkflowBase);
