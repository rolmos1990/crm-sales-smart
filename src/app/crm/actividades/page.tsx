import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/shared/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DashboardActividades } from "@/crm/actividades/components/dashboard-actividades";
import { obtenerActividades } from "@/crm/actividades/queries";
import { requireSesion } from "@/shared/auth/sesion";
import type { Actividad } from "@/crm/actividades/types";

export default async function ActividadesPage() {
  const sesion = await requireSesion();
  let actividades: Actividad[] = [];
  try {
    const datos = await obtenerActividades(sesion.instanciaId);
    actividades = datos as unknown as Actividad[];
  } catch {
    // DB no configurada
  }

  if (actividades.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Actividades</h1>
            <p className="text-sm text-muted-foreground mt-1">Seguimiento de llamadas, emails, reuniones y tareas</p>
          </div>
          <ButtonLink href="/crm/actividades/nueva"><Plus className="mr-2 h-4 w-4" />Nueva actividad</ButtonLink>
        </div>
        <EmptyState
          Icono={CalendarCheck}
          titulo="Sin actividades todavía"
          descripcion="Registra llamadas, reuniones, emails y tareas para hacer seguimiento."
          accion={
            <ButtonLink href="/crm/actividades/nueva">
              <Plus className="mr-2 h-4 w-4" />Crear primera actividad
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Actividades</h1>
          <p className="text-sm text-muted-foreground mt-1">Seguimiento de llamadas, emails, reuniones y tareas</p>
        </div>
      </div>
      <DashboardActividades actividades={actividades} />
    </div>
  );
}
