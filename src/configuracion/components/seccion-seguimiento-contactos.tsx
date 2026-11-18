"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { guardarUmbralesSeguimientoAction } from "@/configuracion/empresa/actions";
import { UmbralesSeguimientoSchema } from "@/configuracion/empresa/schema";
import { UMBRALES_SEGUIMIENTO_DEFECTO, type UmbralesSeguimiento } from "@/crm/contactos/segmentacion/cortes";

const CAMPOS: Array<{ clave: keyof UmbralesSeguimiento; etiqueta: string; ayuda: string }> = [
  { clave: "pendiente", etiqueta: "Pendiente de seguimiento", ayuda: "Un interesado sin interacción desde hace estos días necesita seguimiento." },
  { clave: "recuperar", etiqueta: "Por recuperar", ayuda: "Un interesado sin interacción desde hace estos días se puede recuperar." },
  { clave: "inactivo", etiqueta: "Inactivo", ayuda: "Cualquier contacto sin interacción desde hace estos días está inactivo." },
];

/**
 * 041 — Umbrales del seguimiento de contactos. Cambiarlos se refleja en la
 * siguiente visita a Contactos: el seguimiento se calcula en cada consulta.
 */
export function SeccionSeguimientoContactos({ inicial = UMBRALES_SEGUIMIENTO_DEFECTO }: { inicial?: UmbralesSeguimiento }) {
  const [valores, setValores] = useState<UmbralesSeguimiento>(inicial);
  const [guardado, setGuardado] = useState<UmbralesSeguimiento>(inicial);
  const [isPending, startTransition] = useTransition();

  const entrada = {
    diasSeguimientoPendiente: valores.pendiente,
    diasSeguimientoRecuperar: valores.recuperar,
    diasSeguimientoInactivo: valores.inactivo,
  };
  const validacion = UmbralesSeguimientoSchema.safeParse(entrada);
  const sinCambios = JSON.stringify(valores) === JSON.stringify(guardado);

  function guardar() {
    startTransition(async () => {
      const r = await guardarUmbralesSeguimientoAction(entrada);
      if (!r.exito) {
        toast.error(r.error);
        return;
      }
      setGuardado(valores);
      toast.success("Seguimiento de contactos actualizado");
    });
  }

  return (
    <div className="mt-10 max-w-2xl" data-slot="seccion-seguimiento-contactos">
      <h3 className="mb-4 flex items-center gap-1.5 border-b border-border-subtle pb-2 text-xs font-bold tracking-widest text-muted-foreground uppercase">
        <Users className="h-3.5 w-3.5" aria-hidden /> Seguimiento de contactos
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CAMPOS.map((c) => (
          <label key={c.clave} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{c.etiqueta}</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={3650}
                inputMode="numeric"
                value={Number.isNaN(valores[c.clave]) ? "" : valores[c.clave]}
                onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.valueAsNumber }))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">días</span>
            </div>
            <span className="text-xs text-muted-foreground">{c.ayuda}</span>
          </label>
        ))}
      </div>
      {!validacion.success && (
        <p className="mt-3 text-xs text-danger-text">{validacion.error.issues[0]?.message ?? "Valores inválidos"}</p>
      )}
      <div className="mt-4">
        <Button type="button" onClick={guardar} disabled={isPending || sinCambios || !validacion.success}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}
