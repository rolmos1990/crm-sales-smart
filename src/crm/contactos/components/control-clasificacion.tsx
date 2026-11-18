"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { queryKeys } from "@/shared/query-keys";
import { actualizarInteresContactoAction, actualizarPreferenciaContactoAction } from "../actions";
import type { NivelInteresValor } from "../types";
import { ETIQUETA_INTERES } from "./insignias-contacto";

const NIVELES: NivelInteresValor[] = ["ALTO", "MEDIO", "BAJO", "SIN_EVALUAR"];
const ITEMS_INTERES = Object.fromEntries(NIVELES.map((n) => [n, ETIQUETA_INTERES[n]]));

/**
 * 041 — Corrección manual del interés y de "No contactar". Un valor elegido a
 * mano queda fijado: ningún proceso automático lo cambia hasta que alguien lo
 * libere. Solo se muestra con permiso de modificación.
 */
export function ControlClasificacion({
  contactoId,
  interes,
  interesFijado,
  noContactar,
}: {
  contactoId: string;
  interes: NivelInteresValor;
  interesFijado: boolean;
  noContactar: boolean;
}) {
  const queryClient = useQueryClient();
  const [pendiente, iniciar] = useTransition();
  const [confirmarBloqueo, setConfirmarBloqueo] = useState(false);

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.contactos.resumen(contactoId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.contactos.vista() });
  };

  const ejecutar = (accion: () => Promise<{ exito: boolean; error?: string }>, ok: string) =>
    iniciar(async () => {
      const r = await accion();
      if (r.exito) {
        toast.success(ok);
        refrescar();
      } else {
        toast.error(r.error ?? "No se pudo guardar el cambio");
      }
    });

  return (
    <div data-slot="control-clasificacion" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Interés</span>
        <Select
          items={ITEMS_INTERES}
          value={interes}
          disabled={pendiente}
          onValueChange={(v) => {
            if (!v || (v === interes && interesFijado)) return;
            ejecutar(
              () => actualizarInteresContactoAction({ contactoId, accion: { tipo: "FIJAR", nivel: v } }),
              "Interés actualizado",
            );
          }}
        >
          <SelectTrigger size="sm" aria-label="Nivel de interés">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NIVELES.map((n) => (
              <SelectItem key={n} value={n}>
                {ETIQUETA_INTERES[n]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {interesFijado && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pendiente}
            onClick={() =>
              ejecutar(() => actualizarInteresContactoAction({ contactoId, accion: { tipo: "LIBERAR" } }), "Interés liberado")
            }
          >
            <Unlock className="size-3.5" aria-hidden />
            Liberar
          </Button>
        )}
      </div>

      {noContactar ? (
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={pendiente}
          onClick={() =>
            ejecutar(
              () => actualizarPreferenciaContactoAction({ contactoId, noContactar: false }),
              "El contacto vuelve a ser contactable",
            )
          }
        >
          Volver a contactable
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="w-fit" disabled={pendiente} onClick={() => setConfirmarBloqueo(true)}>
          <Ban className="size-3.5" aria-hidden />
          Marcar No contactar
        </Button>
      )}

      <ConfirmacionDialog
        open={confirmarBloqueo}
        onOpenChange={setConfirmarBloqueo}
        titulo="¿Marcar como No contactar?"
        descripcion="La IA y los Workflows dejarán de enviarle mensajes. Si alguien del equipo le escribe, verá un aviso antes de enviar."
        textoConfirmar="Sí, no contactar"
        onConfirmar={() =>
          ejecutar(() => actualizarPreferenciaContactoAction({ contactoId, noContactar: true }), "Contacto marcado como No contactar")
        }
      />
    </div>
  );
}
