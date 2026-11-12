"use client";

import { Copy, CopyPlus, Settings2, Trash2, Unlink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CATALOGO_NODOS } from "../../definicion/catalogo-nodos";
import type { NodoWorkflow } from "../../definicion/schema";

export interface AccionesMenuNodo {
  onConfigurar: () => void;
  onCopiar: () => void;
  onDuplicar: () => void;
  onDesconectar: () => void;
  onEliminar: () => void;
}

/**
 * Menú de acciones del clic derecho sobre un paso del lienzo.
 *
 * No se ancla al nodo sino al cursor: React Flow entrega las coordenadas del
 * evento y el menú se posiciona ahí con un disparador invisible de tamaño
 * cero, para que no se mueva si el nodo se redibuja.
 */
export function MenuNodo({
  posicion,
  nodo,
  seleccionados,
  conConexiones,
  soloLectura,
  acciones,
  onCerrar,
}: {
  posicion: { x: number; y: number };
  nodo: NodoWorkflow;
  /** Pasos sobre los que actúan las acciones: el del clic o la selección múltiple. */
  seleccionados: NodoWorkflow[];
  conConexiones: boolean;
  soloLectura: boolean;
  acciones: AccionesMenuNodo;
  onCerrar: () => void;
}) {
  const varios = seleccionados.length > 1;
  // INICIO es único y es la entrada del Workflow: ni se borra ni se duplica.
  const modificables = seleccionados.filter((n) => n.tipo !== "INICIO").length;

  const titulo = varios
    ? `${seleccionados.length} pasos seleccionados`
    : nodo.etiqueta?.trim() || CATALOGO_NODOS[nodo.tipo].etiqueta;

  return (
    <DropdownMenu open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DropdownMenuTrigger
        tabIndex={-1}
        render={<span className="pointer-events-none fixed h-0 w-0" style={{ left: posicion.x, top: posicion.y }} />}
      />
      <DropdownMenuContent align="start" side="bottom" sideOffset={0} className="w-60">
        <DropdownMenuLabel className="truncate">{titulo}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Con un solo paso el panel de configuración ya se abrió al hacer
            clic derecho; con varios, esta es la forma de bajar a uno. */}
        {varios && (
          <DropdownMenuItem onClick={acciones.onConfigurar}>
            <Settings2 />
            {soloLectura ? "Ver solo este paso" : "Configurar solo este paso"}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={acciones.onCopiar}>
          <Copy />
          {varios ? "Copiar pasos" : "Copiar paso"}
          <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
        </DropdownMenuItem>

        {!soloLectura && (
          <DropdownMenuItem onClick={acciones.onDuplicar} disabled={modificables === 0}>
            <CopyPlus />
            {varios ? "Duplicar pasos" : "Duplicar paso"}
            <DropdownMenuShortcut>Ctrl+D</DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

        {!soloLectura && (
          <DropdownMenuItem onClick={acciones.onDesconectar} disabled={!conConexiones}>
            <Unlink />
            {varios ? "Desconectar pasos" : "Desconectar paso"}
          </DropdownMenuItem>
        )}

        {!soloLectura && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={acciones.onEliminar} disabled={modificables === 0}>
              <Trash2 />
              {modificables === 0
                ? "El paso Inicio no se elimina"
                : varios
                  ? `Eliminar ${modificables} ${modificables === 1 ? "paso" : "pasos"}`
                  : "Eliminar paso"}
              {modificables > 0 && <DropdownMenuShortcut>Supr</DropdownMenuShortcut>}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
