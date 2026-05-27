"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Image as ImageIcon, Type, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormPlantilla } from "./form-plantilla";
import { togglePlantillaActiva, eliminarPlantilla } from "@/configuracion/plantillas/actions";
import type { Plantilla } from "@/configuracion/plantillas/types";

interface ListaPlantillasProps {
  plantillas: Plantilla[];
  instanciaId: string;
}

function BadgeAlias({ alias }: { alias: string }) {
  return (
    <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-700 dark:text-lime-400 border border-lime-500/20">
      /{alias}
    </span>
  );
}

function BadgeTipo({ tipo }: { tipo: string }) {
  if (tipo === "TEXTO_IMAGEN") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-white/8 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-white/10">
        <ImageIcon className="h-3 w-3" />
        Texto + Imagen
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-white/8 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-white/10">
      <Type className="h-3 w-3" />
      Solo texto
    </span>
  );
}

function FilaPlantilla({ plantilla, instanciaId }: { plantilla: Plantilla; instanciaId: string }) {
  const [dialogoEditar, setDialogoEditar] = useState(false);
  const [dialogoEliminar, setDialogoEliminar] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (valor: boolean) => {
    startTransition(async () => {
      const resultado = await togglePlantillaActiva(plantilla.id, valor);
      if (!resultado.exito) toast.error(resultado.error);
    });
  };

  const handleEliminar = () => {
    startTransition(async () => {
      const resultado = await eliminarPlantilla(plantilla.id);
      if (resultado.exito) {
        toast.success("Plantilla eliminada");
        setDialogoEliminar(false);
      } else {
        toast.error(resultado.error);
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-4 py-3.5 px-4 rounded-xl bg-white dark:bg-white/3 border border-stone-100 dark:border-white/8 hover:border-stone-200 dark:hover:border-white/12 transition-all group">
        {/* Info principal */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-stone-900 dark:text-stone-50 truncate">
              {plantilla.nombre}
            </span>
            <BadgeAlias alias={plantilla.alias} />
            <BadgeTipo tipo={plantilla.tipo} />
          </div>
          {plantilla.descripcion && (
            <p className="text-xs text-stone-400 dark:text-stone-500 truncate">
              {plantilla.descripcion}
            </p>
          )}
          {plantilla.contenidoTexto && (
            <p className="text-xs text-stone-500 dark:text-stone-400 truncate italic">
              &quot;{plantilla.contenidoTexto}&quot;
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Switch
            checked={plantilla.activo}
            onCheckedChange={handleToggle}
            disabled={isPending}
            size="sm"
          />

          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setDialogoEditar(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            onClick={() => setDialogoEliminar(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Dialog editar */}
      <Dialog open={dialogoEditar} onOpenChange={setDialogoEditar}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar plantilla</DialogTitle>
          </DialogHeader>
          <FormPlantilla
            instanciaId={instanciaId}
            inicial={plantilla}
            modo="editar"
            onExito={() => setDialogoEditar(false)}
          />
        </DialogContent>
      </Dialog>

      {/* AlertDialog eliminar */}
      <AlertDialog open={dialogoEliminar} onOpenChange={setDialogoEliminar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{plantilla.nombre}</strong> (/{plantilla.alias}) de forma
              permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ListaPlantillas({ plantillas, instanciaId }: ListaPlantillasProps) {
  const [dialogoCrear, setDialogoCrear] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header con botón crear */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {plantillas.length === 0
            ? "No hay plantillas creadas"
            : `${plantillas.length} plantilla${plantillas.length !== 1 ? "s" : ""}`}
        </p>
        <Button
          size="sm"
          className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] gap-1.5"
          onClick={() => setDialogoCrear(true)}
        >
          <Plus className="h-4 w-4" />
          Crear plantilla
        </Button>
      </div>

      {/* Lista */}
      {plantillas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3 border-2 border-dashed border-stone-200 dark:border-white/8 rounded-2xl">
          <div className="p-3 rounded-xl bg-stone-100 dark:bg-white/5">
            <Type className="h-6 w-6 text-stone-400 dark:text-stone-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-600 dark:text-stone-400">Sin plantillas</p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
              Crea tu primera plantilla para usarla en conversaciones y automatizaciones.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {plantillas.map((p) => (
            <FilaPlantilla key={p.id} plantilla={p} instanciaId={instanciaId} />
          ))}
        </div>
      )}

      {/* Dialog crear */}
      <Dialog open={dialogoCrear} onOpenChange={setDialogoCrear}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva plantilla</DialogTitle>
          </DialogHeader>
          <FormPlantilla
            instanciaId={instanciaId}
            modo="crear"
            onExito={() => setDialogoCrear(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
