"use client";

import { ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DialogCamposRequeridosProps {
  open: boolean;
  onClose: () => void;
  stageNombre: string;
  stageColor?: string | null;
  camposFaltantes: string[];
  onIrACampos?: () => void;
}

export function DialogCamposRequeridos({
  open,
  onClose,
  stageNombre,
  stageColor,
  camposFaltantes,
  onIrACampos,
}: DialogCamposRequeridosProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-amber-500/10 text-amber-500">
            <ShieldAlert />
          </AlertDialogMedia>
          <AlertDialogTitle>Campos requeridos</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            <span>Para avanzar a </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: stageColor ?? "#94a3b8" }}
              />
              {stageNombre}
            </span>
            <span> necesitas completar:</span>
            <ul className="mt-3 space-y-1.5">
              {camposFaltantes.map((campo) => (
                <li key={campo} className="flex items-center gap-2 text-sm">
                  <span className="text-amber-500 flex-shrink-0">✦</span>
                  <span className="text-foreground">{campo}</span>
                </li>
              ))}
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Entendido</AlertDialogCancel>
          {onIrACampos && (
            <AlertDialogAction
              className="bg-lime-500 text-stone-950 hover:bg-lime-400"
              onClick={() => {
                onClose();
                onIrACampos();
              }}
            >
              Completar ahora
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
