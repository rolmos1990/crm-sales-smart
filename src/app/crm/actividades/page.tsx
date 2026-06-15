import { Plus, CalendarCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { TimelineActividades } from "@/crm/actividades/components/timeline-actividades";
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

  const pendientes = actividades.filter(a => !a.completada);
  const completadas = actividades.filter(a => a.completada);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        titulo="Actividades"
        descripcion="Seguimiento de llamadas, emails, reuniones y tareas"
        accion={
          <ButtonLink href="/crm/actividades/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva actividad
          </ButtonLink>
        }
      />

      {actividades.length === 0 ? (
        <EmptyState
          Icono={CalendarCheck}
          titulo="Sin actividades todavía"
          descripcion="Registra llamadas, reuniones, emails y tareas para hacer seguimiento."
          accion={
            <ButtonLink href="/crm/actividades/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Crear primera actividad
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white dark:bg-white/5 dark:backdrop-blur-xl border-stone-200 dark:border-white/10 shadow-sm dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.4)] rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-stone-100 dark:border-white/8">
              <CardTitle className="text-sm font-semibold text-stone-900 dark:text-stone-50 flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-amber-400" />
                Pendientes
                <span className="ml-1 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/25">
                  {pendientes.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 pb-3">
              <TimelineActividades actividades={pendientes} />
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-white/5 dark:backdrop-blur-xl border-stone-200 dark:border-white/10 shadow-sm dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.4)] rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-stone-100 dark:border-white/8">
              <CardTitle className="text-sm font-semibold text-stone-900 dark:text-stone-50 flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-emerald-400" />
                Completadas
                <span className="ml-1 inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/25">
                  {completadas.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 pb-3">
              <TimelineActividades actividades={completadas} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
