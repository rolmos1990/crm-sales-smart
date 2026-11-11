"use client";

import { AlertCircle, Copy, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CATALOGO_NODOS } from "../../definicion/catalogo-nodos";
import type { DefinicionWorkflow, NodoWorkflow } from "../../definicion/schema";
import type { OpcionesEditor } from "../../queries";
import { ESTILO_CATEGORIA } from "../estilos";
import { Campo } from "./campos";
import { FormularioNodo } from "./formularios-nodo";
import { ICONOS_NODO } from "./iconos";

export function PanelPropiedades({
  nodo,
  definicion,
  opciones,
  problemas,
  soloLectura,
  onCambiar,
  onDuplicar,
  onEliminar,
  onCerrar,
}: {
  nodo: NodoWorkflow;
  definicion: DefinicionWorkflow;
  opciones: OpcionesEditor;
  problemas: string[];
  soloLectura: boolean;
  onCambiar: (cambio: Partial<Pick<NodoWorkflow, "etiqueta" | "config">>) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
  onCerrar: () => void;
}) {
  const tipo = CATALOGO_NODOS[nodo.tipo];
  const estilo = ESTILO_CATEGORIA[tipo.categoria];
  const Icono = ICONOS_NODO[tipo.icono];

  return (
    <div className="flex h-full flex-col" data-slot="panel-propiedades">
      <div className="flex items-start gap-2.5 border-b border-border p-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", estilo.chip)}>
          {Icono && <Icono className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{tipo.etiqueta}</p>
          <p className="text-xs text-muted-foreground">{tipo.descripcion}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Cerrar panel" onClick={onCerrar}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {problemas.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-danger-border bg-danger-muted p-2.5">
            {problemas.map((p, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-danger-text">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        )}

        <fieldset disabled={soloLectura} className="space-y-4">
          <Campo etiqueta="Nombre del paso (opcional)">
            <Input
              value={nodo.etiqueta ?? ""}
              onChange={(e) => onCambiar({ etiqueta: e.target.value || undefined })}
              placeholder={tipo.etiqueta}
              maxLength={80}
            />
          </Campo>
          <FormularioNodo
            nodo={nodo}
            config={nodo.config}
            definicion={definicion}
            opciones={opciones}
            onChange={(config) => onCambiar({ config })}
          />
        </fieldset>
      </div>

      {!soloLectura && nodo.tipo !== "INICIO" && (
        <div className="flex gap-2 border-t border-border p-3">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onDuplicar}>
            <Copy className="h-4 w-4" />
            Duplicar
          </Button>
          <Button type="button" variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={onEliminar}>
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        </div>
      )}
    </div>
  );
}
