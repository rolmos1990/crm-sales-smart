import Link from "next/link";
import { Plus, CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { TimelineActividades } from "@/crm/actividades/components/timeline-actividades";
import { obtenerActividades } from "@/crm/actividades/queries";
import type { Actividad } from "@/crm/actividades/types";

export default async function ActividadesPage() {
  let actividades: Actividad[] = [];
  try {
    const datos = await obtenerActividades();
    actividades = datos as unknown as Actividad[];
  } catch {
    // DB no configurada
  }

  const pendientes = actividades.filter(a => !a.completada);
  const completadas = actividades.filter(a => a.completada);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Actividades"
        descripcion="Seguimiento de llamadas, emails, reuniones y tareas"
        accion={
          <Link href="/crm/actividades/nueva">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva actividad
            </Button>
          </Link>
        }
      />

      {actividades.length === 0 ? (
        <EmptyState
          Icono={CalendarCheck}
          titulo="Sin actividades todavía"
          descripcion="Registra llamadas, reuniones, emails y tareas para hacer seguimiento."
          accion={
            <Link href="/crm/actividades/nueva">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Crear primera actividad
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-semibold">Pendientes</h2>
              <Badge variant="secondary">{pendientes.length}</Badge>
            </div>
            <Card>
              <CardContent className="pt-4">
                <TimelineActividades actividades={pendientes} />
              </CardContent>
            </Card>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-semibold">Completadas</h2>
              <Badge variant="outline">{completadas.length}</Badge>
            </div>
            <Card>
              <CardContent className="pt-4">
                <TimelineActividades actividades={completadas} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
