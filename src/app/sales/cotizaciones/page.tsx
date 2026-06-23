import { Plus, FileText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaCotizaciones } from "@/sales/cotizaciones/components/lista-cotizaciones";
import { obtenerCotizaciones } from "@/sales/cotizaciones/queries";
import { redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";
import type { Cotizacion } from "@/sales/cotizaciones/types";

export default async function CotizacionesPage() {
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "cotizaciones", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "cotizaciones");
  let cotizaciones: Cotizacion[] = [];
  try {
    const datos = await obtenerCotizaciones(sesion.instanciaId);
    cotizaciones = datos.map((c) => ({
      ...c,
      subtotal:  Number(c.subtotal),
      descuento: Number(c.descuento),
      impuesto:  Number(c.impuesto),
      total:     Number(c.total),
    })) as unknown as Cotizacion[];
  } catch {
    // DB no configurada
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        titulo="Cotizaciones"
        descripcion="Gestiona todas tus cotizaciones"
        accion={puedeMod ? (
          <ButtonLink href="/sales/cotizaciones/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva cotización
          </ButtonLink>
        ) : undefined}
      />
      {cotizaciones.length === 0 ? (
        <EmptyState
          Icono={FileText}
          titulo="Sin cotizaciones todavía"
          descripcion="Crea tu primera cotización para empezar a gestionar tus ventas."
          accion={puedeMod ? (
            <ButtonLink href="/sales/cotizaciones/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Crear primera cotización
            </ButtonLink>
          ) : undefined}
        />
      ) : (
        <ListaCotizaciones cotizaciones={cotizaciones} />
      )}
    </div>
  );
}
