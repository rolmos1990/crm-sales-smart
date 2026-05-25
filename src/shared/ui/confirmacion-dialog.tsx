"use client";

import { ReactNode, useState } from "react";
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
  trigger: ReactNode;
  titulo: string;
  descripcion: string;
  onConfirmar: () => void | Promise<void>;
  variante?: "destructive" | "default";
  textoCancelar?: string;
  textoConfirmar?: string;
}

export function ConfirmacionDialog({
  trigger,
  titulo,
  descripcion,
  onConfirmar,
  variante = "destructive",
  textoCancelar = "Cancelar",
  textoConfirmar = "Confirmar",
}: ConfirmacionDialogProps) {
  const [abierto, setAbierto] = useState(false);
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
      <span onClick={() => setAbierto(true)} className="contents">
        {trigger}
      </span>
      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{titulo}</AlertDialogTitle>
            <AlertDialogDescription>{descripcion}</AlertDialogDescription>
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
