"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Power } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";
import { cambiarWorkflowsEmpresaAction } from "../actions";

/** Interruptor de Workflows para la empresa, con el aviso de D3 antes de activar. */
export function ActivacionWorkflows({
  habilitado,
  etapasConIA,
  puedeModificar,
}: {
  habilitado: boolean;
  etapasConIA: string[];
  puedeModificar: boolean;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState<boolean | null>(null);
  const [guardando, startGuardar] = useTransition();

  const aplicar = (valor: boolean) =>
    startGuardar(async () => {
      const r = await cambiarWorkflowsEmpresaAction(valor);
      setConfirmando(null);
      if (!r.exito) return void toast.error(r.error);
      toast.success(valor ? "Workflows activados para la empresa" : "Workflows desactivados");
      router.refresh();
    });

  return (
    <div
      data-slot="activacion-workflows"
      className={cn(
        "mb-4 flex items-start gap-3 rounded-2xl border p-4",
        habilitado ? "border-success-border bg-success-muted" : "border-border bg-card",
      )}
    >
      <Power className={cn("mt-0.5 h-4 w-4 shrink-0", habilitado ? "text-success-text" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {habilitado ? "Workflows activos en tu empresa" : "Workflows desactivados"}
        </p>
        <p className="text-xs text-muted-foreground">
          {habilitado
            ? "Los Workflows asignados se ejecutan solos. La IA responde únicamente dentro de un paso “Atención IA”."
            : "Puedes crear y publicar Workflows, pero no se ejecutan hasta activarlos. Mientras tanto, la IA por etapa funciona como siempre."}
        </p>
      </div>
      <Switch
        checked={habilitado}
        disabled={!puedeModificar || guardando}
        onCheckedChange={(v) => setConfirmando(v)}
        aria-label="Activar Workflows para la empresa"
      />

      <AlertDialog open={confirmando !== null} onOpenChange={(abierto) => !abierto && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmando ? "¿Activar Workflows?" : "¿Desactivar Workflows?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando
                ? "Los Workflows asignados empezarán a ejecutarse. La IA solo responderá dentro de un paso “Atención IA”: la respuesta automática por etapa deja de actuar (su configuración se conserva)."
                : "Las ejecuciones en curso quedan detenidas donde están (se reanudan si vuelves a activar) y la IA por etapa vuelve a responder como antes."}
            </AlertDialogDescription>
            {confirmando && etapasConIA.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-muted-foreground">
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  Estas etapas hoy responden con IA y dejarán de hacerlo:
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {etapasConIA.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                <p className="mt-1 text-xs">Asígnales un Workflow con “Atención IA” para mantener la atención automática.</p>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={guardando} onClick={() => confirmando !== null && aplicar(confirmando)}>
              {confirmando ? "Activar" : "Desactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
