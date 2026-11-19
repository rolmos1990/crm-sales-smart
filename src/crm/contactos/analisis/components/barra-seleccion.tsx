"use client";

import { useState, useTransition } from "react";
import { Layers, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import type { FiltrosVistaContactos } from "@/crm/contactos/schema";
import { analizarSeleccionadosAction, analizarSegmentoAction } from "../actions";
import { MAX_SELECCION_ANALISIS } from "../schema";

/**
 * 042 (Historia 7) — Acciones en lote sobre la tabla de Contactos:
 * "Analizar seleccionados" (hasta 100) y, para administradores, "Analizar
 * todo el segmento" con confirmación. Lo que se encola cuenta contra el
 * presupuesto de la cuenta, por eso el aviso lo dice.
 */
export function BarraSeleccion({
  seleccionados,
  filtros,
  total,
  puedeAnalizarSegmento,
  onLimpiar,
}: {
  seleccionados: string[];
  filtros: FiltrosVistaContactos;
  total: number;
  puedeAnalizarSegmento: boolean;
  onLimpiar: () => void;
}) {
  const [pendiente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const n = seleccionados.length;
  if (n === 0 && !puedeAnalizarSegmento) return null;

  const analizarSeleccion = () =>
    iniciar(async () => {
      const r = await analizarSeleccionadosAction({ contactoIds: seleccionados });
      if (!r.exito) return void toast.error(r.error);
      toast.success(`${r.datos.encolados} ${r.datos.encolados === 1 ? "contacto" : "contactos"} en análisis`);
      onLimpiar();
    });

  const analizarSegmento = () =>
    iniciar(async () => {
      const r = await analizarSegmentoAction({ filtros });
      setConfirmando(false);
      if (!r.exito) return void toast.error(r.error);
      toast.success(`${r.datos.encolados} contactos encolados para análisis`);
    });

  return (
    <div
      data-slot="barra-seleccion-analisis"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-muted/30 px-4 py-2"
    >
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {n > 0 ? `${n} ${n === 1 ? "seleccionado" : "seleccionados"}` : "Seleccioná contactos para analizarlos con IA"}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {n > 0 && (
          <>
            <Button size="sm" variant="ghost" onClick={onLimpiar} disabled={pendiente}>
              <X className="size-3.5" aria-hidden />
              Limpiar
            </Button>
            <Button size="sm" variant="outline" onClick={analizarSeleccion} disabled={pendiente || n > MAX_SELECCION_ANALISIS}>
              <Sparkles className="size-3.5" aria-hidden />
              Analizar seleccionados
            </Button>
          </>
        )}
        {puedeAnalizarSegmento && (
          <Button size="sm" variant="ghost" onClick={() => setConfirmando(true)} disabled={pendiente || total === 0}>
            <Layers className="size-3.5" aria-hidden />
            Analizar todo el segmento
          </Button>
        )}
      </div>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Analizar {total.toLocaleString("es")} contactos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se analizan los contactos que cumplen los filtros actuales, de a poco y sin adelantarse a los urgentes. El
              consumo de IA corre por los proveedores de tu cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={analizarSegmento} disabled={pendiente}>
              Analizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
