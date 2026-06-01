"use client";

import { type ReactNode, useState } from "react";
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

interface ConfirmacionDialogProps {
  // Modo no-controlado: el diálogo maneja su propio estado via trigger
  trigger?: ReactNode;
  // Modo controlado: para usar dentro de dropdowns u otros floating elements
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  titulo: string;
  descripcion: ReactNode;
  onConfirmar: () => void | Promise<void>;
  variante?: "destructive" | "default";
  textoCancelar?: string;
  textoConfirmar?: string;
}

export function ConfirmacionDialog({
  trigger,
  open: openProp,
  onOpenChange,
  titulo,
  descripcion,
  onConfirmar,
  variante = "destructive",
  textoCancelar = "Cancelar",
  textoConfirmar = "Confirmar",
}: ConfirmacionDialogProps) {
  const [internoAbierto, setInternoAbierto] = useState(false);
  const isControlled = openProp !== undefined;
  const abierto = isControlled ? openProp! : internoAbierto;
  const setAbierto = isControlled ? onOpenChange! : setInternoAbierto;

  const [cargando, setCargando] = useState(false);

  const handleConfirmar = async () => {
    setCargando(true);
    try {
      await onConfirmar();
      setAbierto(false);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      {trigger && (
        <span onClick={() => setAbierto(true)} className="contents">
          {trigger}
        </span>
      )}
      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{titulo}</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              {descripcion}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cargando}>{textoCancelar}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmar}
              disabled={cargando}
              className={
                variante === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {cargando ? "Procesando..." : textoConfirmar}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
