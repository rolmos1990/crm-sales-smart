import { Plus, FileText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaCotizaciones } from "@/sales/cotizaciones/components/lista-cotizaciones";
import { obtenerCotizaciones } from "@/sales/cotizaciones/queries";
import type { Cotizacion } from "@/sales/cotizaciones/types";

export default async function CotizacionesPage() {
  let cotizaciones: Cotizacion[] = [];
  try {
    const datos = await obtenerCotizaciones();
    cotizaciones = datos as unknown as Cotizacion[];
  } catch {
    // DB no configurada
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        titulo="Cotizaciones"
        descripcion="Gestiona todas tus cotizaciones"
        accion={
          <ButtonLink href="/sales/cotizaciones/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva cotización
          </ButtonLink>
        }
      />
      {cotizaciones.length === 0 ? (
        <EmptyState
          Icono={FileText}
          titulo="Sin cotizaciones todavía"
          descripcion="Crea tu primera cotización para empezar a gestionar tus ventas."
          accion={
            <ButtonLink href="/sales/cotizaciones/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Crear primera cotización
            </ButtonLink>
          }
        />
      ) : (
        <ListaCotizaciones cotizaciones={cotizaciones} />
      )}
    </div>
  );
}
