"use client";

// 010-enrutamiento-modelos-ia-por-objetivo — asignar qué proveedor de IA
// activo atiende cada objetivo (clasificación, extracción, resumen,
// identificación de productos, sentimiento, conversación estándar y
// conversación de mayor razonamiento). Sin asignación explícita, el sistema
// sigue usando el criterio actual (prioridad + tipo de agente) — FR-005.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Waypoints } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { guardarAsignacionesObjetivoIA } from "@/configuracion/ia/actions";
import type { AsignacionObjetivoIA } from "@/configuracion/ia/queries";
import type { ObjetivoEnrutamiento } from "@/configuracion/ia/schema";

const ETIQUETA_OBJETIVO: Record<ObjetivoEnrutamiento, string> = {
  CLASIFICACION: "Clasificación de intención",
  EXTRACCION_ENTIDADES: "Extracción de datos",
  RESUMEN: "Resumen",
  IDENTIFICACION_PRODUCTO: "Identificación de productos",
  SENTIMIENTO: "Detección de sentimiento",
  CHAT: "Conversación estándar",
  CHAT_RAZONAMIENTO_SUPERIOR: "Conversación de mayor razonamiento",
};

const DESCRIPCION_OBJETIVO: Record<ObjetivoEnrutamiento, string> = {
  CLASIFICACION: "Económico — decide de qué trata un mensaje",
  EXTRACCION_ENTIDADES: "Económico — saca datos estructurados de un texto",
  RESUMEN: "Económico — resume una conversación",
  IDENTIFICACION_PRODUCTO: "Económico — identifica qué producto menciona el cliente",
  SENTIMIENTO: "Económico — detecta el ánimo del cliente",
  CHAT: "Conversación normal con el cliente",
  CHAT_RAZONAMIENTO_SUPERIOR: "Reservado para ambigüedad alta, clientes molestos o recomendaciones complejas",
};

const OPCION_DEFECTO = "__DEFECTO__";

interface ProveedorActivoOpcion {
  id: string;
  proveedor: string;
}

interface SeccionEnrutamientoProps {
  asignacionesIniciales: AsignacionObjetivoIA[];
  proveedoresActivos: ProveedorActivoOpcion[];
}

export function SeccionEnrutamiento({ asignacionesIniciales, proveedoresActivos }: SeccionEnrutamientoProps) {
  const [asignaciones, setAsignaciones] = useState(asignacionesIniciales);
  const [isPending, startTransition] = useTransition();

  const itemsProveedores: Record<string, string> = {
    [OPCION_DEFECTO]: "Usar criterio por defecto",
    ...Object.fromEntries(proveedoresActivos.map((p) => [p.id, p.proveedor])),
  };

  function actualizarLocal(objetivo: ObjetivoEnrutamiento, proveedorIAId: string | null) {
    setAsignaciones((actuales) =>
      actuales.map((a) => (a.objetivo === objetivo ? { ...a, proveedorIAId, proveedorInvalido: false } : a)),
    );
  }

  function guardar() {
    startTransition(async () => {
      const resultado = await guardarAsignacionesObjetivoIA(
        asignaciones.map((a) => ({ objetivo: a.objetivo, proveedorIAId: a.proveedorIAId })),
      );
      if (!resultado.exito) {
        toast.error(resultado.error ?? "Error al guardar el enrutamiento");
        return;
      }
      toast.success("Enrutamiento guardado");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Waypoints className="h-4 w-4 text-stone-400" />
        <h3 className="text-sm font-semibold text-stone-200 uppercase tracking-wide">
          Enrutamiento por objetivo
        </h3>
      </div>
      <p className="text-stone-500 text-xs -mt-2">
        Asigná un proveedor económico a las tareas simples y reservá el más potente para conversación compleja.
      </p>

      <div className="rounded-xl border border-white/8 bg-white/3 divide-y divide-white/8">
        {asignaciones.map((asignacion) => (
          <div key={asignacion.objetivo} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-stone-200 text-sm font-medium">{ETIQUETA_OBJETIVO[asignacion.objetivo]}</p>
              <p className="text-stone-500 text-xs">{DESCRIPCION_OBJETIVO[asignacion.objetivo]}</p>
              {asignacion.proveedorInvalido && (
                <p className="text-amber-400 text-xs flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  El proveedor asignado ya no está activo — elegí otro
                </p>
              )}
            </div>
            <Select
              items={itemsProveedores}
              value={asignacion.proveedorIAId ?? OPCION_DEFECTO}
              onValueChange={(valor) =>
                actualizarLocal(asignacion.objetivo, valor === OPCION_DEFECTO ? null : valor)
              }
            >
              <SelectTrigger className="w-56 flex-shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OPCION_DEFECTO}>Usar criterio por defecto</SelectItem>
                {proveedoresActivos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.proveedor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <Button
        type="button"
        onClick={guardar}
        disabled={isPending}
        className="self-end rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] font-semibold"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar enrutamiento"}
      </Button>
    </div>
  );
}
