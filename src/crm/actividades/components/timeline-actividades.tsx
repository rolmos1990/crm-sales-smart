"use client";

import { useState } from "react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { CheckCircle2, Circle, Trash2, Phone, Mail, Users, CheckSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { completarActividad, eliminarActividad } from "../actions";
import type { Actividad, TipoActividad } from "../types";
import { cn } from "@/lib/utils";

const ICONOS_TIPO: Record<TipoActividad, React.ElementType> = {
  LLAMADA: Phone,
  EMAIL: Mail,
  REUNION: Users,
  TAREA: CheckSquare,
  NOTA: FileText,
};

const COLORES_TIPO: Record<TipoActividad, string> = {
  LLAMADA: "text-blue-500 bg-blue-50",
  EMAIL: "text-violet-500 bg-violet-50",
  REUNION: "text-green-500 bg-green-50",
  TAREA: "text-amber-500 bg-amber-50",
  NOTA: "text-slate-500 bg-slate-50",
};

function formatearFecha(fecha: Date) {
  const f = new Date(fecha);
  if (isToday(f)) return `Hoy ${format(f, "HH:mm")}`;
  if (isTomorrow(f)) return `Mañana ${format(f, "HH:mm")}`;
  return format(f, "dd MMM yyyy, HH:mm", { locale: es });
}

export function TimelineActividades({ actividades }: { actividades: Actividad[] }) {
  const [procesando, setProcesando] = useState<string | null>(null);

  const handleCompletar = async (id: string) => {
    setProcesando(id);
    const resultado = await completarActividad(id);
    setProcesando(null);
    if (resultado.exito) toast.success("Actividad completada");
    else toast.error(resultado.error);
  };

  const handleEliminar = async (id: string) => {
    const resultado = await eliminarActividad(id);
    if (resultado.exito) toast.success("Actividad eliminada");
    else toast.error(resultado.error);
  };

  if (actividades.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No hay actividades registradas.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {actividades.map((actividad, idx) => {
        const Icono = ICONOS_TIPO[actividad.tipo];
        const colorClase = COLORES_TIPO[actividad.tipo];
        const vencida = !actividad.completada && isPast(new Date(actividad.fecha));

        return (
          <div key={actividad.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn("rounded-full p-1.5 mt-0.5", colorClase, actividad.completada && "opacity-50")}>
                <Icono className="h-3.5 w-3.5" />
              </div>
              {idx < actividades.length - 1 && (
                <div className="w-px flex-1 bg-border mt-1" />
              )}
            </div>
            <div className={cn("pb-4 flex-1 min-w-0", actividad.completada && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium leading-tight", actividad.completada && "line-through text-muted-foreground")}>
                    {actividad.titulo}
                  </p>
                  {actividad.descripcion && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{actividad.descripcion}</p>
                  )}
                  <p className={cn("text-xs mt-1", vencida ? "text-destructive font-medium" : "text-muted-foreground")}>
                    {formatearFecha(actividad.fecha)}
                    {vencida && " · Vencida"}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!actividad.completada && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={procesando === actividad.id}
                      onClick={() => handleCompletar(actividad.id)}
                      title="Marcar como completada"
                    >
                      {procesando === actividad.id ? (
                        <Circle className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground hover:text-green-500" />
                      )}
                    </Button>
                  )}
                  <ConfirmacionDialog
                    trigger={
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    }
                    titulo="¿Eliminar actividad?"
                    descripcion={`Se eliminará "${actividad.titulo}".`}
                    onConfirmar={() => handleEliminar(actividad.id)}
                  />
                </div>
              </div>
              {actividad.completada && actividad.completadaEn && (
                <Badge variant="outline" className="mt-1 text-xs text-green-600 border-green-200">
                  Completada {format(new Date(actividad.completadaEn), "dd MMM", { locale: es })}
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
