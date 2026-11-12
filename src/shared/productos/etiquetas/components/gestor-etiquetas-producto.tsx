"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { COLORES_TAG } from "@/crm/tags/types";
import { actualizarEtiquetaProducto, crearEtiquetaProducto, eliminarEtiquetaProducto } from "../actions";
import type { EtiquetaProducto } from "../types";

function SelectorColor({ color, onElegir, disabled }: { color: string | null; onElegir: (c: string) => void; disabled?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        disabled={disabled}
        aria-label="Cambiar color"
        className="h-8 w-8 shrink-0 rounded-lg border border-border p-1.5 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="block h-full w-full rounded-full" style={{ backgroundColor: color ?? "#a8a29e" }} />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-5 gap-1.5">
          {COLORES_TAG.map((c) => (
            <button
              key={c.valor}
              type="button"
              title={c.etiqueta}
              aria-label={c.etiqueta}
              onClick={() => {
                onElegir(c.valor);
                setAbierto(false);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              style={{ backgroundColor: c.valor }}
            >
              {c.valor === color && <Check className="h-3.5 w-3.5 text-background" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilaEtiqueta({ etiqueta, onEliminar }: { etiqueta: EtiquetaProducto; onEliminar: (e: EtiquetaProducto) => void }) {
  const [nombre, setNombre] = useState(etiqueta.nombre);
  const [guardando, startGuardar] = useTransition();

  const guardar = (cambios: { nombre?: string; color?: string }) =>
    startGuardar(async () => {
      const r = await actualizarEtiquetaProducto(etiqueta.id, cambios);
      if (!r.exito) {
        toast.error(r.error);
        setNombre(etiqueta.nombre);
      }
    });

  const confirmarNombre = () => {
    const limpio = nombre.trim();
    if (!limpio) return setNombre(etiqueta.nombre);
    if (limpio !== etiqueta.nombre) guardar({ nombre: limpio });
  };

  return (
    <li className="flex items-center gap-2">
      <SelectorColor color={etiqueta.color} onElegir={(color) => guardar({ color })} disabled={guardando} />
      <Input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={confirmarNombre}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setNombre(etiqueta.nombre);
        }}
        maxLength={40}
        aria-label="Nombre de la etiqueta"
        className="h-8 flex-1"
      />
      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {guardando ? (
          <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />
        ) : (
          `${etiqueta.totalProductos} producto${etiqueta.totalProductos === 1 ? "" : "s"}`
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Eliminar ${etiqueta.nombre}`}
        onClick={() => onEliminar(etiqueta)}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

/** Crear, renombrar, recolorear y eliminar las etiquetas del catálogo. */
export function GestorEtiquetasProducto({
  etiquetas,
  abierto,
  onAbiertoChange,
}: {
  etiquetas: EtiquetaProducto[];
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
}) {
  const [nueva, setNueva] = useState("");
  const [colorNueva, setColorNueva] = useState<string>(COLORES_TAG[0].valor);
  const [creando, startCrear] = useTransition();
  const [porEliminar, setPorEliminar] = useState<EtiquetaProducto | null>(null);

  const crear = () => {
    const nombre = nueva.trim();
    if (!nombre) return;
    startCrear(async () => {
      const r = await crearEtiquetaProducto({ nombre, color: colorNueva });
      if (!r.exito) return void toast.error(r.error);
      setNueva("");
      setColorNueva(COLORES_TAG[(etiquetas.length + 1) % COLORES_TAG.length].valor);
    });
  };

  const eliminar = async () => {
    if (!porEliminar) return;
    const r = await eliminarEtiquetaProducto(porEliminar.id);
    if (r.exito) toast.success(`Etiqueta “${porEliminar.nombre}” eliminada`);
    else toast.error(r.error);
  };

  return (
    <>
      <Dialog open={abierto} onOpenChange={onAbiertoChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4" />
              Etiquetas de productos
            </DialogTitle>
            <DialogDescription>
              Clasifica tu catálogo (por ejemplo Esfera, Base, Pequeña). Son distintas de las etiquetas de contactos y oportunidades.
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              crear();
            }}
          >
            <SelectorColor color={colorNueva} onElegir={setColorNueva} disabled={creando} />
            <Input
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="Nueva etiqueta"
              maxLength={40}
              aria-label="Nombre de la nueva etiqueta"
              className="h-8 flex-1"
            />
            <Button type="submit" size="sm" disabled={creando || !nueva.trim()}>
              {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear
            </Button>
          </form>

          {etiquetas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
              Aún no tienes etiquetas.
            </p>
          ) : (
            <ul className="-mx-1 max-h-80 space-y-2 overflow-y-auto px-1 py-1">
              {etiquetas.map((e) => (
                // key con nombre: si se renombra desde otro lado, la fila toma el valor nuevo.
                <FilaEtiqueta key={`${e.id}-${e.nombre}`} etiqueta={e} onEliminar={setPorEliminar} />
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmacionDialog
        open={porEliminar !== null}
        onOpenChange={(v) => !v && setPorEliminar(null)}
        titulo={`¿Eliminar la etiqueta “${porEliminar?.nombre ?? ""}”?`}
        descripcion={
          porEliminar?.totalProductos
            ? `Se quitará de ${porEliminar.totalProductos} producto${porEliminar.totalProductos === 1 ? "" : "s"}. Los productos no se modifican.`
            : "No está asignada a ningún producto."
        }
        textoConfirmar="Eliminar"
        onConfirmar={eliminar}
      />
    </>
  );
}
