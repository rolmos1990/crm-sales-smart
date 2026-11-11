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

const HANDLE = "!h-3 !w-3 !border-2 !border-card !bg-muted-foreground transition-colors hover:!bg-primary";

function NodoWorkflowBase({ data, selected }: NodeProps<NodoFlow>) {
  const { nodo, resumen, salidas, problemas } = data;
  const tipo = CATALOGO_NODOS[nodo.tipo];
  const estilo = ESTILO_CATEGORIA[tipo.categoria];
  const Icono = ICONOS_NODO[tipo.icono];
  const unaSalida = salidas.length === 1;

  return (
    <div
      data-slot="nodo-workflow"
      className={cn(
        "w-64 rounded-xl border bg-card shadow-sm transition-shadow",
        selected ? "border-primary ring-2 ring-primary/30" : "border-card-border",
        problemas.length > 0 && !selected && "border-danger-border",
      )}
    >
      {nodo.tipo !== "INICIO" && <Handle type="target" position={Position.Top} id="entrada" className={HANDLE} />}

      <div className={cn("h-1 rounded-t-xl", estilo.acento)} />
      <div className="flex items-start gap-2.5 p-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", estilo.chip)}>
          {Icono && <Icono className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{tipo.etiqueta}</p>
          <p className="truncate text-sm font-medium text-foreground">{nodo.etiqueta?.trim() || tipo.etiqueta}</p>
          {resumen ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{resumen}</p>
          ) : (
            <p className="mt-0.5 text-xs italic text-muted-foreground">Sin configurar</p>
          )}
        </div>
        {problemas.length > 0 && (
          <span title={problemas.join("\n")} className="shrink-0 text-danger">
            <AlertCircle className="h-4 w-4" aria-label={`${problemas.length} problema(s)`} />
          </span>
        )}
      </div>

      {unaSalida && <Handle type="source" position={Position.Bottom} id={salidas[0].id} className={HANDLE} />}

      {salidas.length > 1 && (
        <ul className="border-t border-card-divider py-1">
          {salidas.map((s) => (
            <li key={s.id} className="relative flex items-center justify-end px-3 py-1">
              <span className="truncate text-[11px] text-muted-foreground">{s.etiqueta}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={s.id}
                className={HANDLE}
                style={{ top: "50%" }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const NodoWorkflowFlow = memo(NodoWorkflowBase);
