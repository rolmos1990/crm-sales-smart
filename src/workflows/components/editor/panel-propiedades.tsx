"use client";

import { AlertCircle, Clock, Copy, Info, MessageSquare, Settings2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CATALOGO_NODOS, salidasDeNodo } from "../../definicion/catalogo-nodos";
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
      <div className="flex items-start gap-2.5 px-3 pb-2 pt-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", estilo.chip)}>
          {Icono && <Icono className="h-4.5 w-4.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{nodo.etiqueta?.trim() || tipo.etiqueta}</p>
          <p className="text-xs text-text-tertiary">Configuración del nodo</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Cerrar panel" onClick={onCerrar}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="configuracion" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="border-b border-border px-3">
          <TabsList variant="line" className="h-9 w-full justify-start gap-4">
            <TabsTrigger value="configuracion" className="flex-none px-0 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Configuración
            </TabsTrigger>
            <TabsTrigger value="detalles" className="flex-none px-0 text-xs">
              <Info className="h-3.5 w-3.5" />
              Detalles
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="configuracion" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
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
            <FormularioNodo
              nodo={nodo}
              config={nodo.config}
              definicion={definicion}
              opciones={opciones}
              onChange={(config) => onCambiar({ config })}
            />
          </fieldset>
        </TabsContent>

        <TabsContent value="detalles" className="min-h-0 flex-1 overflow-y-auto p-3">
          <Detalles
            nodo={nodo}
            definicion={definicion}
            soloLectura={soloLectura}
            onCambiarEtiqueta={(etiqueta) => onCambiar({ etiqueta })}
          />
        </TabsContent>
      </Tabs>

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

/** Qué es este nodo, cómo se llama y a dónde va cada una de sus salidas. */
function Detalles({
  nodo,
  definicion,
  soloLectura,
  onCambiarEtiqueta,
}: {
  nodo: NodoWorkflow;
  definicion: DefinicionWorkflow;
  soloLectura: boolean;
  onCambiarEtiqueta: (etiqueta: string | undefined) => void;
}) {
  const tipo = CATALOGO_NODOS[nodo.tipo];
  const estilo = ESTILO_CATEGORIA[tipo.categoria];
  const salidas = salidasDeNodo(nodo.tipo, nodo.config);
  const nombreDestino = (destino: string) => {
    const n = definicion.nodos.find((x) => x.id === destino);
    return n ? n.etiqueta?.trim() || CATALOGO_NODOS[n.tipo].etiqueta : null;
  };

  return (
    <div className="space-y-4">
      <fieldset disabled={soloLectura}>
        <Campo etiqueta="Nombre del paso (opcional)">
          <Input
            value={nodo.etiqueta ?? ""}
            onChange={(e) => onCambiarEtiqueta(e.target.value || undefined)}
            placeholder={tipo.etiqueta}
            maxLength={80}
          />
        </Campo>
      </fieldset>

      <section className="rounded-lg border border-border bg-surface-2/40 p-3">
        <div className="flex items-center gap-1.5">
          <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider", estilo.badge)}>
            {tipo.etiqueta}
          </span>
          <span className="text-[11px] text-text-tertiary">{estilo.etiqueta}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-text-secondary">{tipo.descripcion}</p>

        {(tipo.esEspera || tipo.enviaMensajes) && (
          <ul className="mt-2.5 space-y-1.5 border-t border-card-divider pt-2.5">
            {tipo.esEspera && (
              <li className="flex items-start gap-1.5 text-[11px] text-text-tertiary">
                <Clock className="mt-px h-3.5 w-3.5 shrink-0" />
                Pausa la ejecución hasta que ocurra el evento que espera.
              </li>
            )}
            {tipo.enviaMensajes && (
              <li className="flex items-start gap-1.5 text-[11px] text-text-tertiary">
                <MessageSquare className="mt-px h-3.5 w-3.5 shrink-0" />
                Escribe al cliente por el canal de la conversación.
              </li>
            )}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
          Salidas ({salidas.length})
        </p>
        {salidas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-2.5 py-3 text-center text-[11px] text-text-tertiary">
            Este paso termina la ejecución del Workflow.
          </p>
        ) : (
          <ul className="divide-y divide-card-divider overflow-hidden rounded-lg border border-border">
            {salidas.map((s) => {
              const conexion = definicion.conexiones.find((c) => c.origen === nodo.id && c.salida === s.id);
              const destino = conexion ? nombreDestino(conexion.destino) : null;
              return (
                <li key={s.id} className="flex items-center gap-2 px-2.5 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-foreground">{s.etiqueta}</span>
                  {destino ? (
                    <span className="max-w-[9rem] truncate text-[11px] text-text-tertiary" title={destino}>
                      → {destino}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded border border-warning/40 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                      Sin conectar
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">Identificador</p>
        <code className="block truncate rounded-md border border-border bg-surface-2/40 px-2 py-1.5 font-mono text-[11px] text-text-tertiary">
          {nodo.id}
        </code>
      </section>
    </div>
  );
}
